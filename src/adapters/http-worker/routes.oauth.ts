// Workers adapter for OAuth routes using itty-router
// Provider-agnostic version from Spotify MCP

// itty-router types are complex; use generic interface
interface IttyRouter {
	get(path: string, handler: (request: Request) => Promise<Response>): void;
	post(path: string, handler: (request: Request) => Promise<Response>): void;
}

import type { UnifiedConfig } from "../../shared/config/env.js";
import {
	jsonResponse,
	oauthError,
	redirectResponse,
	textError,
} from "../../shared/http/response.js";
import { handleRegister, handleRevoke } from "../../shared/oauth/endpoints.js";
import {
	handleAuthorize,
	handleProviderCallback,
	handleToken,
} from "../../shared/oauth/flow.js";
import {
	buildFlowOptions,
	buildOAuthConfig,
	buildProviderConfig,
	buildTokenInput,
	parseAuthorizeInput,
	parseCallbackInput,
	parseTokenInput,
} from "../../shared/oauth/input-parsers.js";
import type { TokenStore } from "../../shared/storage/interface.js";
import { sharedLogger as logger } from "../../shared/utils/logger.js";

export function attachOAuthRoutes(
	router: IttyRouter,
	store: TokenStore,
	config: UnifiedConfig,
): void {
	const providerConfig = buildProviderConfig(config);
	const oauthConfig = buildOAuthConfig(config);

	router.get("/authorize", async (request: Request) => {
		logger.info("oauth_workers", { message: "Authorize request received" });

		try {
			const url = new URL(request.url);
			const sessionId = request.headers.get("Mcp-Session-Id") ?? undefined;
			const input = parseAuthorizeInput(url, sessionId);
			const options = {
				...buildFlowOptions(url, config),
				cimd: {
					enabled: config.CIMD_ENABLED,
					timeoutMs: config.CIMD_FETCH_TIMEOUT_MS,
					maxBytes: config.CIMD_MAX_RESPONSE_BYTES,
					allowedDomains: config.CIMD_ALLOWED_DOMAINS,
				},
			};

			const result = await handleAuthorize(
				input,
				store,
				providerConfig,
				oauthConfig,
				options,
			);

			logger.info("oauth_workers", {
				message: "Authorize redirect",
				redirectTo: result.redirectTo,
			});
			return redirectResponse(result.redirectTo);
		} catch (error) {
			logger.error("oauth_workers", {
				message: "Authorize failed",
				error: (error as Error).message,
			});
			return textError((error as Error).message || "Authorization failed");
		}
	});

	// Google (provider) callback — receives provider auth code and composite state
	router.get("/oauth/provider-callback", async (request: Request) => {
		const url = new URL(request.url);
		const { code, state } = parseCallbackInput(url);

		logger.info("oauth_workers", {
			message: "Callback request received",
			hasCode: !!code,
			hasState: !!state,
			stateLength: state?.length,
		});

		try {
			if (!code || !state) {
				return textError("invalid_callback: missing code or state");
			}

			if (!config.PROVIDER_CLIENT_ID || !config.PROVIDER_CLIENT_SECRET) {
				logger.error("oauth_workers", {
					message: "Missing provider credentials",
				});
				return textError("Server misconfigured: Missing provider credentials", {
					status: 500,
				});
			}

			const options = buildFlowOptions(url, config);

			const result = await handleProviderCallback(
				{ providerCode: code, compositeState: state },
				store,
				providerConfig,
				oauthConfig,
				options,
			);

			logger.info("oauth_workers", {
				message: "Callback success",
				redirectTo: result.redirectTo,
			});
			return redirectResponse(result.redirectTo);
		} catch (error) {
			logger.error("oauth_workers", {
				message: "Callback failed",
				error: (error as Error).message,
			});
			return textError((error as Error).message || "Callback failed", {
				status: 500,
			});
		}
	});

	// MCP client callback — browser lands here after the worker redirects back with RS code
	router.get("/oauth/callback", async (request: Request) => {
		const url = new URL(request.url);
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");

		logger.info("oauth_workers", {
			message: "Client callback received",
			hasCode: !!code,
			hasState: !!state,
		});

		// Return a success page; the MCP client extracts the code from the URL
		return new Response(
			`<!DOCTYPE html><html><head><title>Authentication Complete</title></head><body>
<h2>Authentication successful</h2>
<p>You can close this window and return to your application.</p>
<script>
// Some MCP clients read the URL params from the opener window
if (window.opener) {
  window.opener.postMessage({ type: 'oauth_callback', code: ${JSON.stringify(code)}, state: ${JSON.stringify(state)} }, '*');
  window.close();
}
</script>
</body></html>`,
			{ headers: { "content-type": "text/html; charset=utf-8" } },
		);
	});

	router.post("/token", async (request: Request) => {
		logger.debug("oauth_workers", { message: "Token request received" });

		try {
			const form = await parseTokenInput(request);
			const tokenInput = buildTokenInput(form);

			if ("error" in tokenInput) {
				return oauthError(tokenInput.error);
			}

			// Pass providerConfig for refresh_token grant to enable provider token refresh
			const result = await handleToken(tokenInput, store, providerConfig);

			logger.info("oauth_workers", { message: "Token exchange success" });
			return jsonResponse(result);
		} catch (error) {
			logger.error("oauth_workers", {
				message: "Token exchange failed",
				error: (error as Error).message,
			});
			return oauthError((error as Error).message || "invalid_grant");
		}
	});

	router.post("/revoke", async () => {
		const result = await handleRevoke();
		return jsonResponse(result);
	});

	router.post("/register", async (request: Request) => {
		try {
			const body = (await request.json().catch(() => ({}))) as Record<
				string,
				unknown
			>;
			const url = new URL(request.url);

			logger.debug("oauth_workers", { message: "Register request" });

			const result = await handleRegister(
				{
					redirect_uris: Array.isArray(body.redirect_uris)
						? (body.redirect_uris as string[])
						: undefined,
					grant_types: Array.isArray(body.grant_types)
						? (body.grant_types as string[])
						: undefined,
					response_types: Array.isArray(body.response_types)
						? (body.response_types as string[])
						: undefined,
					client_name:
						typeof body.client_name === "string" ? body.client_name : undefined,
				},
				url.origin,
				config.OAUTH_REDIRECT_URI,
			);

			logger.info("oauth_workers", { message: "Client registered" });
			return jsonResponse(result, { status: 201 });
		} catch (error) {
			return oauthError((error as Error).message);
		}
	});
}
