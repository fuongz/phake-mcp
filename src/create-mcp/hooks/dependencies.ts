const templateHooks: Record<string, () => void | Promise<void>> = {};

export function registerInstallationHook(
	_templateName: string,
	_install?: boolean,
	_pm?: string,
): void {
	if (!_install) return;

	const packageManager = _pm ?? "npm";

	const installCommand =
		packageManager === "npm"
			? "npm install"
			: packageManager === "bun"
				? "bun install"
				: packageManager === "yarn"
					? "yarn"
					: packageManager === "pnpm"
						? "pnpm install"
						: "npm install";

	templateHooks[_templateName] = async () => {
		const { execSync } = await import("node:child_process");
		console.log(`Running: ${installCommand}`);
		execSync(installCommand, { stdio: "inherit" });
	};
}

export function applyInstallationHook(
	templateName: string,
): void | Promise<void> {
	const hook = templateHooks[templateName];
	if (hook) {
		hook();
	}
}
