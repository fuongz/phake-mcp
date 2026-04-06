import { describe, expect, spyOn, test } from "bun:test";
import {
	applyInstallationHook,
	registerInstallationHook,
} from "../../create-mcp/hooks/dependencies.js";

describe("registerInstallationHook", () => {
	test("does not register a hook when install is false", () => {
		const spy = spyOn(console, "log").mockImplementation(() => {});

		registerInstallationHook("tmpl-no-install", false, "npm");
		applyInstallationHook("tmpl-no-install");

		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	test("does not register a hook when install is undefined", () => {
		const spy = spyOn(console, "log").mockImplementation(() => {});

		registerInstallationHook("tmpl-undef");
		applyInstallationHook("tmpl-undef");

		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});
});

describe("applyInstallationHook", () => {
	test("does nothing for an unregistered template", () => {
		expect(() => applyInstallationHook("non-existent-template")).not.toThrow();
	});

	test("returns undefined (void) for unregistered template", () => {
		const result = applyInstallationHook("also-non-existent");
		expect(result).toBeUndefined();
	});

	// Note: testing the full async execution of a registered hook is not
	// straightforward because applyInstallationHook does not return the hook's
	// promise. The install command mapping is covered by inspecting the console.log
	// output via the hook, which requires the dynamic child_process import to settle.
	// This behavior is exercised by integration tests or manual testing.
});
