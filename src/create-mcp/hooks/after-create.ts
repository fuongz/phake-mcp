export interface AfterCreateOptions {
	projectName: string;
	directoryPath: string;
	packageManager: string;
}

export const afterCreateHook = {
	applyHook(_templateName: string, options: AfterCreateOptions): void {
		// Currently just a placeholder for future hooks
		// Could add: git init, env file setup, etc.
		console.log(`Project created: ${options.projectName}`);
	},
};
