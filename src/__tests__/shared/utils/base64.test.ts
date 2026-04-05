import { describe, expect, test } from "bun:test";
import {
	base64Decode,
	base64Encode,
	base64UrlDecode,
	base64UrlDecodeJson,
	base64UrlDecodeString,
	base64UrlEncode,
	base64UrlEncodeJson,
	base64UrlEncodeString,
} from "../../../shared/utils/base64.js";

describe("base64Encode / base64Decode", () => {
	test("encodes a plain string", () => {
		expect(base64Encode("hello")).toBe("aGVsbG8=");
	});

	test("decodes back to original string", () => {
		expect(base64Decode("aGVsbG8=")).toBe("hello");
	});

	test("roundtrips arbitrary strings", () => {
		const inputs = ["", "a", "abc", "Hello, World!", "!@#$%^&*()"];
		for (const input of inputs) {
			expect(base64Decode(base64Encode(input))).toBe(input);
		}
	});
});

describe("base64UrlEncode / base64UrlDecode", () => {
	test("produces URL-safe output (no +, /, =)", () => {
		const bytes = new Uint8Array([0xfb, 0xff, 0xfe]);
		const encoded = base64UrlEncode(bytes);
		expect(encoded).not.toContain("+");
		expect(encoded).not.toContain("/");
		expect(encoded).not.toContain("=");
	});

	test("roundtrips arbitrary bytes", () => {
		const original = new Uint8Array([1, 2, 3, 255, 0, 128, 64]);
		const encoded = base64UrlEncode(original);
		const decoded = base64UrlDecode(encoded);
		expect(decoded).toEqual(original);
	});

	test("decodes standard base64url without padding", () => {
		// "hello" in base64url is "aGVsbG8"
		const decoded = base64UrlDecode("aGVsbG8");
		expect(new TextDecoder().decode(decoded)).toBe("hello");
	});
});

describe("base64UrlEncodeString / base64UrlDecodeString", () => {
	test("roundtrips plain ASCII", () => {
		const s = "Hello, World!";
		expect(base64UrlDecodeString(base64UrlEncodeString(s))).toBe(s);
	});

	test("roundtrips unicode", () => {
		const s = "こんにちは 🎉";
		expect(base64UrlDecodeString(base64UrlEncodeString(s))).toBe(s);
	});
});

describe("base64UrlEncodeJson / base64UrlDecodeJson", () => {
	test("roundtrips a plain object", () => {
		const obj = { offset: 10, foo: "bar" };
		const encoded = base64UrlEncodeJson(obj);
		expect(base64UrlDecodeJson(encoded)).toEqual(obj);
	});

	test("returns empty string for non-serializable value", () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		expect(base64UrlEncodeJson(circular)).toBe("");
	});

	test("returns null for invalid base64 JSON", () => {
		expect(base64UrlDecodeJson("!!!invalid!!!")).toBeNull();
	});
});
