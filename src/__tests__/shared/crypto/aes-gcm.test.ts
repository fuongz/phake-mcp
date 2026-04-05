import { describe, expect, test } from "bun:test";
import {
	createEncryptor,
	decrypt,
	encrypt,
	generateKey,
} from "../../../shared/crypto/aes-gcm.js";

// ─────────────────────────────────────────────────────────────────────────────
// generateKey
// ─────────────────────────────────────────────────────────────────────────────

describe("generateKey", () => {
	test("returns a non-empty string", () => {
		expect(generateKey()).toBeTruthy();
	});

	test("produces different keys each call", () => {
		expect(generateKey()).not.toBe(generateKey());
	});

	test("decodes to exactly 32 bytes", () => {
		const key = generateKey();
		// base64url decode: re-pad and decode
		let base64 = key.replace(/-/g, "+").replace(/_/g, "/");
		base64 += "=".repeat((4 - (base64.length % 4)) % 4);
		const binary = atob(base64);
		expect(binary.length).toBe(32);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// encrypt / decrypt
// ─────────────────────────────────────────────────────────────────────────────

describe("encrypt / decrypt", () => {
	test("roundtrips a plain string", async () => {
		const key = generateKey();
		const plaintext = "Hello, World!";
		const ciphertext = await encrypt(plaintext, key);
		expect(await decrypt(ciphertext, key)).toBe(plaintext);
	});

	test("roundtrips an empty string", async () => {
		const key = generateKey();
		const ciphertext = await encrypt("", key);
		expect(await decrypt(ciphertext, key)).toBe("");
	});

	test("roundtrips unicode content", async () => {
		const key = generateKey();
		const plaintext = "こんにちは 🎉 مرحبا";
		const ciphertext = await encrypt(plaintext, key);
		expect(await decrypt(ciphertext, key)).toBe(plaintext);
	});

	test("produces different ciphertexts for same plaintext (random IV)", async () => {
		const key = generateKey();
		const c1 = await encrypt("same", key);
		const c2 = await encrypt("same", key);
		expect(c1).not.toBe(c2);
	});

	test("ciphertext is a non-empty URL-safe string", async () => {
		const key = generateKey();
		const ciphertext = await encrypt("test", key);
		expect(ciphertext).toBeTruthy();
		expect(ciphertext).not.toContain("+");
		expect(ciphertext).not.toContain("/");
	});

	test("throws for wrong key", async () => {
		const key1 = generateKey();
		const key2 = generateKey();
		const ciphertext = await encrypt("secret", key1);
		await expect(decrypt(ciphertext, key2)).rejects.toThrow();
	});

	test("throws for truncated ciphertext", async () => {
		const key = generateKey();
		await expect(decrypt("short", key)).rejects.toThrow();
	});

	test("throws for invalid key length (not 32 bytes)", async () => {
		// base64url of 16 random bytes
		const shortKey = btoa(String.fromCharCode(...new Uint8Array(16)))
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
		await expect(encrypt("test", shortKey)).rejects.toThrow();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// createEncryptor
// ─────────────────────────────────────────────────────────────────────────────

describe("createEncryptor", () => {
	test("encrypt and decrypt are bound to the key", async () => {
		const encryptor = createEncryptor(generateKey());
		const ciphertext = await encryptor.encrypt("bound test");
		expect(await encryptor.decrypt(ciphertext)).toBe("bound test");
	});

	test("two encryptors with different keys cannot cross-decrypt", async () => {
		const e1 = createEncryptor(generateKey());
		const e2 = createEncryptor(generateKey());
		const ciphertext = await e1.encrypt("data");
		await expect(e2.decrypt(ciphertext)).rejects.toThrow();
	});
});
