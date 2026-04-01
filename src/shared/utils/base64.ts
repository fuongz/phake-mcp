/**
 * Base64/base64url utilities for Cloudflare Workers.
 * Uses Web APIs (btoa/atob).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Base64 Standard
// ─────────────────────────────────────────────────────────────────────────────

export function base64Encode(input: string): string {
	return btoa(input);
}

export function base64Decode(input: string): string {
	return atob(input);
}

// ─────────────────────────────────────────────────────────────────────────────
// Base64URL (RFC 4648 §5)
// ─────────────────────────────────────────────────────────────────────────────

export function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

export function base64UrlDecode(str: string): Uint8Array {
	let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
	const padLength = (4 - (base64.length % 4)) % 4;
	base64 += "=".repeat(padLength);

	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

export function base64UrlEncodeString(input: string): string {
	return base64UrlEncode(new TextEncoder().encode(input));
}

export function base64UrlDecodeString(input: string): string {
	return new TextDecoder().decode(base64UrlDecode(input));
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON helpers
// ─────────────────────────────────────────────────────────────────────────────

export function base64UrlEncodeJson(obj: unknown): string {
	try {
		return base64UrlEncodeString(JSON.stringify(obj));
	} catch {
		return "";
	}
}

export function base64UrlDecodeJson<T = unknown>(value: string): T | null {
	try {
		return JSON.parse(base64UrlDecodeString(value)) as T;
	} catch {
		return null;
	}
}
