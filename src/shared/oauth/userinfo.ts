/**
 * Get user info from OAuth provider's userinfo endpoint.
 * Works with Google, GitHub, and other OAuth providers that support userinfo.
 *
 * @param accessToken - The provider's access token
 * @param userinfoUrl - The userinfo endpoint URL (e.g., https://www.googleapis.com/oauth2/v2/userinfo)
 * @returns User info object or null on failure
 */
export async function getUser(
	accessToken: string,
	userinfoUrl: string,
): Promise<Record<string, unknown> | null> {
	try {
		const response = await fetch(userinfoUrl, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		if (!response.ok) {
			return null;
		}

		return (await response.json()) as Record<string, unknown>;
	} catch {
		return null;
	}
}

/**
 * Common userinfo endpoint URLs for major OAuth providers.
 */
export const USERINFO_ENDPOINTS = {
	google: "https://www.googleapis.com/oauth2/v2/userinfo",
	github: "https://api.github.com/user",
} as const;

/**
 * Get the appropriate userinfo URL based on the auth strategy.
 * Falls back to provider accounts URL if no known endpoint.
 */
export function getUserinfoUrl(
	authStrategy: string | undefined,
	providerAccountsUrl: string | undefined,
): string | undefined {
	switch (authStrategy) {
		case "google":
			return USERINFO_ENDPOINTS.google;
		case "github":
			return USERINFO_ENDPOINTS.github;
		case "oauth":
			// For generic OAuth, try to derive from provider accounts URL
			if (providerAccountsUrl) {
				// Common pattern: accounts.example.com -> api.example.com/userinfo
				return providerAccountsUrl
					.replace("accounts.", "api.")
					.replace("/oauth", "/userinfo");
			}
			return undefined;
		default:
			return undefined;
	}
}
