import { describe, expect, test } from "bun:test";
import {
	createCursor,
	paginateArray,
	parseCursor,
} from "../../../shared/utils/pagination.js";

describe("createCursor / parseCursor", () => {
	test("encodes and decodes offset", () => {
		expect(parseCursor(createCursor(0))).toBe(0);
		expect(parseCursor(createCursor(50))).toBe(50);
		expect(parseCursor(createCursor(999))).toBe(999);
	});

	test("parseCursor returns 0 for undefined", () => {
		expect(parseCursor(undefined)).toBe(0);
	});

	test("parseCursor returns 0 for invalid cursor", () => {
		expect(parseCursor("not-a-valid-cursor")).toBe(0);
	});

	test("parseCursor returns 0 when offset is missing in decoded object", () => {
		// base64-encode JSON without offset field
		const cursor = btoa(JSON.stringify({ page: 1 }));
		expect(parseCursor(cursor)).toBe(0);
	});
});

describe("paginateArray", () => {
	const items = Array.from({ length: 100 }, (_, i) => i);

	test("returns first page with default limit", () => {
		const result = paginateArray(items);
		expect(result.data).toHaveLength(50);
		expect(result.data[0]).toBe(0);
		expect(result.data[49]).toBe(49);
		expect(result.nextCursor).toBeDefined();
	});

	test("returns second page using nextCursor", () => {
		const first = paginateArray(items);
		const second = paginateArray(items, first.nextCursor);
		expect(second.data).toHaveLength(50);
		expect(second.data[0]).toBe(50);
		expect(second.nextCursor).toBeUndefined();
	});

	test("respects custom limit", () => {
		const result = paginateArray(items, undefined, 10);
		expect(result.data).toHaveLength(10);
		expect(result.nextCursor).toBeDefined();
	});

	test("returns no nextCursor on last page", () => {
		const result = paginateArray(items, undefined, 100);
		expect(result.data).toHaveLength(100);
		expect(result.nextCursor).toBeUndefined();
	});

	test("handles empty array", () => {
		const result = paginateArray([]);
		expect(result.data).toHaveLength(0);
		expect(result.nextCursor).toBeUndefined();
	});

	test("handles array smaller than limit", () => {
		const result = paginateArray([1, 2, 3], undefined, 50);
		expect(result.data).toEqual([1, 2, 3]);
		expect(result.nextCursor).toBeUndefined();
	});
});
