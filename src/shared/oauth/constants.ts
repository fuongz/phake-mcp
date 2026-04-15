/** OAuth provider endpoint constants */

export const GOOGLE = {
	ACCOUNTS_URL: "https://accounts.google.com",
	AUTHORIZATION_URL: "https://accounts.google.com/o/oauth2/v2/auth",
	TOKEN_URL: "https://oauth2.googleapis.com/token",
	DEFAULT_SCOPES: "openid email profile",
} as const;

export const GITHUB = {
	ACCOUNTS_URL: "https://github.com",
	AUTHORIZATION_URL: "https://github.com/login/oauth/authorize",
	TOKEN_URL: "https://github.com/login/oauth/access_token",
	DEFAULT_SCOPES: "read:user",
} as const;
