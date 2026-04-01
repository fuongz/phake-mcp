// Storage singleton for Workers
// Uses the storage initialized by initializeWorkerStorage

import type { SessionStore, TokenStore } from "./interface.js";

let tokenStoreInstance: TokenStore | null = null;
let sessionStoreInstance: SessionStore | null = null;

export function initializeStorage(
	tokenStore: TokenStore,
	sessionStore: SessionStore,
): void {
	tokenStoreInstance = tokenStore;
	sessionStoreInstance = sessionStore;
}

export function getTokenStore(): TokenStore {
	if (!tokenStoreInstance) {
		throw new Error(
			"TokenStore not initialized. Call initializeStorage first.",
		);
	}
	return tokenStoreInstance;
}

export function getSessionStore(): SessionStore {
	if (!sessionStoreInstance) {
		throw new Error(
			"SessionStore not initialized. Call initializeStorage first.",
		);
	}
	return sessionStoreInstance;
}
