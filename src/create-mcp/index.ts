import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import confirm from "@inquirer/confirm";
import input from "@inquirer/input";
import select from "@inquirer/select";
import type { Command } from "commander";
import { Option, program } from "commander";
import { createSpinner } from "nanospinner";
import * as picocolors from "picocolors";
import { afterCreateHook } from "./hooks/after-create.js";
import { knownPackageManagerNames, templates } from "./templates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function _getTemplatesDir(): string {
	return path.join(__dirname, "..", "templates");
}

const version = "0.1.0";

const isCurrentDirRegex = /^(\.\/|\.\\|\.)$/;

const config = {
	directory: "templates",
	repository: "phake-mcp",
	user: "fuongz",
	ref: "main",
} as const;

function mkdirp(dir: string) {
	try {
		fs.mkdirSync(dir, { recursive: true });
	} catch (e) {
		if (e instanceof Error) {
			if ("code" in e && e.code === "EEXIST") {
				return;
			}
		}
		throw e;
	}
}

program
	.name("create-phake-mcp")
	.version(version)
	.arguments("[target]")
	.addOption(new Option("-i, --install", "Install dependencies").default(false))
	.addOption(
		new Option("-p, --pm <pm>", "Package manager to use").choices(
			knownPackageManagerNames,
		),
	)
	.addOption(
		new Option("-t, --template <template>", "Template to use").choices(
			templates.map((t) => t.value),
		),
	)
	.addOption(new Option("-o, --offline", "Use offline mode").default(false))
	.action(main);

type ArgOptions = {
	pm?: string;
	offline: boolean;
	install?: boolean;
	template?: string;
};

async function main(
	targetDir: string | undefined,
	options: ArgOptions,
	command: Command,
) {
	console.log(
		picocolors.gray(`${command.name()} version ${command.version()}`),
	);

	const { install, pm, offline: _offline, template: templateArg } = options;

	let target = "";
	if (targetDir) {
		target = targetDir;
		console.log(
			`${picocolors.bold(`${picocolors.green("✔")} Using target directory`)} … ${target}`,
		);
	} else {
		const answer = await input({
			message: "Target directory",
			default: "my-mcp-app",
		});
		target = answer;
	}

	let projectName = "";
	if (isCurrentDirRegex.test(target)) {
		projectName = path.basename(process.cwd());
	} else {
		projectName = path.basename(target);
	}

	const templateName =
		templateArg ||
		(await select({
			loop: true,
			message: "Which template do you want to use?",
			choices: templates.map(
				(template: { value: string; description: string }) => ({
					title: template.description,
					value: template.value,
				}),
			),
			default: 0,
		}));

	if (!templateName) {
		throw new Error("No template selected");
	}

	const templateExists = templates.some(
		(t: { value: string }) => t.value === templateName,
	);
	if (!templateExists) {
		throw new Error(`Invalid template selected: ${templateName}`);
	}

	if (fs.existsSync(target)) {
		if (fs.readdirSync(target).length > 0) {
			const response = await confirm({
				message: "Directory not empty. Continue?",
				default: false,
			});
			if (!response) {
				process.exit(1);
			}
		}
	} else {
		mkdirp(target);
	}

	const targetDirectoryPath = path.join(process.cwd(), target);
	const packageManager = pm ?? "npm";

	try {
		const spinner = createSpinner("Copying template").start();

		const templateSource = path.join(
			__dirname,
			"..",
			"..",
			config.directory,
			templateName,
		);

		if (!fs.existsSync(templateSource)) {
			throw new Error(`Template not found: ${templateName}`);
		}

		copyDirectory(templateSource, targetDirectoryPath);

		spinner.success();

		if (install) {
			const { execSync } = await import("node:child_process");
			const installCmd =
				packageManager === "npm"
					? "npm install"
					: packageManager === "bun"
						? "bun install"
						: packageManager === "yarn"
							? "yarn"
							: "pnpm install";

			console.log(`Running: ${installCmd}`);
			execSync(installCmd, { stdio: "inherit", cwd: targetDirectoryPath });
		}

		afterCreateHook.applyHook(templateName, {
			projectName,
			directoryPath: targetDirectoryPath,
			packageManager,
		});
	} catch (e) {
		throw new Error(
			`Error running hook for ${templateName}: ${
				e instanceof Error ? e.message : e
			}`,
		);
	}

	const packageJsonPath = path.join(targetDirectoryPath, "package.json");

	if (fs.existsSync(packageJsonPath)) {
		const packageJson = fs.readFileSync(packageJsonPath, "utf-8");

		const packageJsonParsed = JSON.parse(packageJson);
		const newPackageJson = {
			name: projectName,
			...packageJsonParsed,
		};

		fs.writeFileSync(packageJsonPath, JSON.stringify(newPackageJson, null, 2));
	}

	console.log(
		picocolors.green(`🎉 ${picocolors.bold("Copied project files")}`),
	);
	const resolvedTarget = path.resolve(target);
	const currentDir = process.cwd();

	if (resolvedTarget !== currentDir) {
		console.log(
			picocolors.gray("Get started with:"),
			picocolors.bold(`cd ${target}`),
		);
	}
	process.exit(0);
}

function copyDirectory(src: string, dest: string) {
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}

	const entries = fs.readdirSync(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			copyDirectory(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

program.parse();
