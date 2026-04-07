// Shared OAuth input parsing for both Node.js and Cloudflare Workers

import type { UnifiedConfig } from "../config/env.js";
import type {
	AuthorizeInput,
	OAuthConfig,
	ProviderConfig,
	TokenInput,
} from "./types.js";

/**
 * Parse authorization request from URL search params.
 */
export function parseAuthorizeInput(
	url: URL,
	sessionId?: string,
): AuthorizeInput {
	return {
		clientId: url.searchParams.get("client_id") ?? undefined,
		codeChallenge: url.searchParams.get("code_challenge") || "",
		codeChallengeMethod: url.searchParams.get("code_challenge_method") || "",
		redirectUri: url.searchParams.get("redirect_uri") || "",
		requestedScope: url.searchParams.get("scope") ?? undefined,
		state: url.searchParams.get("state") ?? undefined,
		sid: url.searchParams.get("sid") || sessionId || undefined,
	};
}

/**
 * Parse callback request from URL search params.
 */
export function parseCallbackInput(url: URL): {
	code: string | null;
	state: string | null;
} {
	return {
		code: url.searchParams.get("code"),
		state: url.searchParams.get("state"),
	};
}

/**
 * Parse token request from form data or JSON body.
 */
export async function parseTokenInput(
	request: Request,
): Promise<URLSearchParams> {
	const contentType = request.headers.get("content-type") || "";

	if (contentType.includes("application/x-www-form-urlencoded")) {
		const text = await request.text();
		return new URLSearchParams(text);
	}

	// Try JSON fallback
	const json = (await request.json().catch(() => ({}))) as Record<
		string,
		string
	>;
	return new URLSearchParams(json);
}

/**
 * Build TokenInput from parsed form data.
 */
export function buildTokenInput(
	form: URLSearchParams,
): TokenInput | { error: string } {
	const grant = form.get("grant_type");

	if (grant === "refresh_token") {
		const refreshToken = form.get("refresh_token");
		if (!refreshToken) {
			return { error: "missing_refresh_token" };
		}
		return { grant: "refresh_token", refreshToken };
	}

	if (grant === "authorization_code") {
		const code = form.get("code");
		const codeVerifier = form.get("code_verifier");
		if (!code || !codeVerifier) {
			return { error: "missing_code_or_verifier" };
		}
		return { grant: "authorization_code", code, codeVerifier };
	}

	return { error: "unsupported_grant_type" };
}

/**
 * Build ProviderConfig from UnifiedConfig.
 */
export function buildProviderConfig(config: UnifiedConfig): ProviderConfig {
	// For Google strategy, use preset endpoints
	if (config.AUTH_STRATEGY === "google") {
		return buildGoogleProviderConfig(config);
	}

	// For GitHub strategy, use preset endpoints
	if (config.AUTH_STRATEGY === "github") {
		return buildGitHubProviderConfig(config);
	}

	// Pass full URLs directly — new URL(absoluteUrl, base) ignores the base,
	// so providers with different hosts for auth vs token (e.g. Google) work correctly.
	return {
		clientId: config.PROVIDER_CLIENT_ID,
		clientSecret: config.PROVIDER_CLIENT_SECRET,
		accountsUrl: config.PROVIDER_ACCOUNTS_URL || "https://provider.example.com",
		oauthScopes: config.OAUTH_SCOPES,
		extraAuthParams: config.OAUTH_EXTRA_AUTH_PARAMS,
		authorizationEndpointPath: config.OAUTH_AUTHORIZATION_URL,
		tokenEndpointPath: config.OAUTH_TOKEN_URL,
	};
}

/**
 * Build Google-specific ProviderConfig with preset endpoints.
 */
export function buildGoogleProviderConfig(
	config: UnifiedConfig,
): ProviderConfig {
	return {
		clientId: config.PROVIDER_CLIENT_ID || config.OAUTH_CLIENT_ID,
		clientSecret: config.PROVIDER_CLIENT_SECRET || config.OAUTH_CLIENT_SECRET,
		accountsUrl: config.PROVIDER_ACCOUNTS_URL || "https://accounts.google.com",
		oauthScopes: config.OAUTH_SCOPES || "openid email profile",
		extraAuthParams: config.OAUTH_EXTRA_AUTH_PARAMS,
		authorizationEndpointPath:
			config.OAUTH_AUTHORIZATION_URL ||
			"https://accounts.google.com/o/oauth2/v2/auth",
		tokenEndpointPath:
			config.OAUTH_TOKEN_URL || "https://oauth2.googleapis.com/token",
	};
}

/**
 * Build GitHub-specific ProviderConfig with preset endpoints.
 * Uses OAUTH_* env vars (shared with other OAuth providers).
 */
export function buildGitHubProviderConfig(
	config: UnifiedConfig,
): ProviderConfig {
	return {
		clientId: config.OAUTH_CLIENT_ID || config.PROVIDER_CLIENT_ID,
		clientSecret: config.OAUTH_CLIENT_SECRET || config.PROVIDER_CLIENT_SECRET,
		accountsUrl: config.PROVIDER_ACCOUNTS_URL || "https://github.com",
		oauthScopes: config.OAUTH_SCOPES || "read:user",
		extraAuthParams: config.OAUTH_EXTRA_AUTH_PARAMS,
		authorizationEndpointPath:
			config.OAUTH_AUTHORIZATION_URL ||
			"https://github.com/login/oauth/authorize",
		tokenEndpointPath:
			config.OAUTH_TOKEN_URL || "https://github.com/login/oauth/access_token",
	};
}

/**
 * Build OAuthConfig from UnifiedConfig.
 */
export function buildOAuthConfig(config: UnifiedConfig): OAuthConfig {
	return {
		redirectUri: config.OAUTH_REDIRECT_URI,
		redirectAllowlist: config.OAUTH_REDIRECT_ALLOWLIST,
		redirectAllowAll: config.OAUTH_REDIRECT_ALLOW_ALL,
	};
}

/**
 * Build flow options from request URL.
 */
export function buildFlowOptions(
	url: URL,
	config: UnifiedConfig,
	overrides: { callbackPath?: string; tokenEndpointPath?: string } = {},
): {
	baseUrl: string;
	isDev: boolean;
	callbackPath: string;
	tokenEndpointPath: string;
} {
	return {
		baseUrl: config.BASE_URL ?? url.origin,
		isDev: config.NODE_ENV === "development",
		callbackPath: overrides.callbackPath ?? "/oauth/provider-callback",
		tokenEndpointPath: overrides.tokenEndpointPath ?? "/api/token",
	};
}
