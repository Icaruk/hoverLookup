import fs from "node:fs";
import path from "node:path";
import * as vscode from "vscode";
import {
	DATABASE_RELOAD_TYPE,
	getDatabasePath,
	getIdField,
	getRawJsonData,
	isJsonDatabaseEnabled,
	loadDatabase,
	reindexDatabase,
} from "./database.js";
import {
	connectMongo,
	disconnectMongo,
	isMongoDBEnabled,
} from "./mongoDatabase.js";

/**
 * Register the reload database command
 * @param {vscode.ExtensionContext} context
 */
function registerReloadCommand(context) {
	const reloadCommand = vscode.commands.registerCommand(
		"hoverLookup.reloadDatabase",
		() => {
			const dbPaths = getDatabasePath();
			if (dbPaths && dbPaths.length > 0) {
				loadDatabase(dbPaths, DATABASE_RELOAD_TYPE.MANUAL_RELOAD);
			} else {
				vscode.window.showErrorMessage(
					"HoverLookup: No database files found. Please create a lookup-database.json file in your workspace.",
				);
			}
		},
	);

	context.subscriptions.push(reloadCommand);
}

/**
 * Register the init database command
 * @param {vscode.ExtensionContext} context
 */
function registerInitCommand(context) {
	const initCommand = vscode.commands.registerCommand(
		"hoverLookup.initDatabase",
		async () => {
			if (
				!vscode.workspace.workspaceFolders ||
				vscode.workspace.workspaceFolders.length === 0
			) {
				vscode.window.showErrorMessage(
					"HoverLookup: No workspace folder found. Please open a folder first.",
				);
				return;
			}

			const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
			const dbPaths = getDatabasePath();
			const defaultPath = path.join(workspaceRoot, "lookup-database.json");
			const targetPath =
				dbPaths && dbPaths.length > 0 ? dbPaths[0] : defaultPath;

			// Check if file already exists
			if (fs.existsSync(targetPath)) {
				const overwrite = await vscode.window.showWarningMessage(
					`File ${path.basename(targetPath)} already exists. Overwrite?`,
					{ modal: true },
					"Yes",
					"No",
				);

				if (overwrite !== "Yes") {
					return;
				}
			}

			// Create the example database with mixed object types
			const exampleDatabase = {
				version: 1,
				idField: ["id", "userId", "code"],
				data: [
					{
						id: 1,
						name: "John Doe",
						email: "john@example.com",
						role: "admin",
					},
					{
						userId: 42,
						name: "Jane Smith",
						email: "jane@example.com",
						department: "Engineering",
					},
					{
						code: "ORD-2024-001",
						status: "shipped",
						total: 299.99,
						customer: "Acme Corp",
					},
				],
			};

			try {
				fs.writeFileSync(
					targetPath,
					JSON.stringify(exampleDatabase, null, 2),
					"utf8",
				);
				vscode.window.showInformationMessage(
					`HoverLookup: Database file created at ${path.basename(targetPath)}`,
				);

				// Open the file
				const document = await vscode.workspace.openTextDocument(targetPath);
				await vscode.window.showTextDocument(document);

				// Load the database
				loadDatabase([targetPath]);
			} catch (error) {
				vscode.window.showErrorMessage(
					`HoverLookup: Failed to create database file: ${error.message}`,
				);
			}
		},
	);

	context.subscriptions.push(initCommand);
}

/**
 * Register the reconnect MongoDB command
 * @param {vscode.ExtensionContext} context
 */
function registerReconnectMongoDBCommand(context) {
	const reconnectMongoCommand = vscode.commands.registerCommand(
		"hoverLookup.reconnectMongoDB",
		async () => {
			try {
				// Disconnect first
				await disconnectMongo();

				// Try to reconnect
				const client = await connectMongo();
				if (client) {
					vscode.window.showInformationMessage(
						"HoverLookup: Successfully reconnected to MongoDB",
					);
				} else {
					vscode.window.showWarningMessage(
						"HoverLookup: MongoDB URL not configured. Set hoverLookup.mongodbUrl in settings.",
					);
				}
			} catch (error) {
				vscode.window.showErrorMessage(
					`HoverLookup: Failed to reconnect to MongoDB: ${error.message}`,
				);
			}
		},
	);

	context.subscriptions.push(reconnectMongoCommand);
}

/**
 * Register the toggle JSON database command
 * @param {vscode.ExtensionContext} context
 */
function registerToggleLookupJsonDatabaseCommand(context) {
	const toggleCommand = vscode.commands.registerCommand(
		"hoverLookup.toggleLookupJsonDatabase",
		async () => {
			const config = vscode.workspace.getConfiguration("hoverLookup");
			const currentValue = isJsonDatabaseEnabled();
			const currentStatus = currentValue ? "Enabled" : "Disabled";

			const options = [
				{
					label: "$(check) Enable",
					description: currentValue ? "(current)" : "",
					value: true,
				},
				{
					label: "$(circle-slash) Disable",
					description: !currentValue ? "(current)" : "",
					value: false,
				},
			];

			const selected = await vscode.window.showQuickPick(options, {
				placeHolder: `JSON Database Lookup is currently ${currentStatus}. Select an option:`,
			});

			if (selected === undefined) {
				return; // User cancelled
			}

			if (selected.value === currentValue) {
				vscode.window.showInformationMessage(
					`HoverLookup: JSON Database lookup is already ${selected.value ? "enabled" : "disabled"}`,
				);
				return;
			}

			await config.update(
				"enableJsonDatabase",
				selected.value,
				vscode.ConfigurationTarget.Workspace,
			);

			const status = selected.value ? "enabled" : "disabled";
			vscode.window.showInformationMessage(
				`HoverLookup: JSON Database lookup ${status}`,
			);
		},
	);

	context.subscriptions.push(toggleCommand);
}

/**
 * Register the toggle MongoDB command
 * @param {vscode.ExtensionContext} context
 */
function registerToggleLookupMongoDBCommand(context) {
	const toggleCommand = vscode.commands.registerCommand(
		"hoverLookup.toggleLookupMongoDB",
		async () => {
			const config = vscode.workspace.getConfiguration("hoverLookup");
			const currentValue = isMongoDBEnabled();
			const currentStatus = currentValue ? "Enabled" : "Disabled";

			const options = [
				{
					label: "$(check) Enable",
					description: currentValue ? "(current)" : "",
					value: true,
				},
				{
					label: "$(circle-slash) Disable",
					description: !currentValue ? "(current)" : "",
					value: false,
				},
			];

			const selected = await vscode.window.showQuickPick(options, {
				placeHolder: `MongoDB Lookup is currently ${currentStatus}. Select an option:`,
			});

			if (selected === undefined) {
				return; // User cancelled
			}

			if (selected.value === currentValue) {
				vscode.window.showInformationMessage(
					`HoverLookup: MongoDB lookup is already ${selected.value ? "enabled" : "disabled"}`,
				);
				return;
			}

			await config.update(
				"enableMongoDB",
				selected.value,
				vscode.ConfigurationTarget.Workspace,
			);

			const status = selected.value ? "enabled" : "disabled";
			vscode.window.showInformationMessage(
				`HoverLookup: MongoDB lookup ${status}`,
			);

			// If disabling, disconnect from MongoDB
			if (!selected.value) {
				await disconnectMongo();
			}
		},
	);

	context.subscriptions.push(toggleCommand);
}

/**
 * Register the open settings command
 * @param {vscode.ExtensionContext} context
 */
function registerOpenSettingsCommand(context) {
	const openSettingsCommand = vscode.commands.registerCommand(
		"hoverLookup.openSettings",
		() => {
			// Open VSCode settings and filter by HoverLookup
			vscode.commands.executeCommand(
				"workbench.action.openSettings",
				"@ext:Icaruk.hoverlookup",
			);
		},
	);

	context.subscriptions.push(openSettingsCommand);
}

/**
 * Register the clear MongoDB cache command
 * @param {vscode.ExtensionContext} context
 */
function registerClearMongoCacheCommand(context) {
	const clearCacheCommand = vscode.commands.registerCommand(
		"hoverLookup.clearMongoCache",
		async () => {
			try {
				const { clearMongoCache } = await import("./mongoDatabase.js");
				clearMongoCache();
				vscode.window.showInformationMessage(
					"HoverLookup: MongoDB cache cleared successfully",
				);
			} catch (error) {
				vscode.window.showErrorMessage(
					`HoverLookup: Failed to clear MongoDB cache: ${error.message}`,
				);
			}
		},
	);

	context.subscriptions.push(clearCacheCommand);
}

/**
 * Register all commands
 * @param {vscode.ExtensionContext} context
 */
function registerAllCommands(context) {
	registerReloadCommand(context);
	registerInitCommand(context);
	registerReconnectMongoDBCommand(context);
	registerToggleLookupJsonDatabaseCommand(context);
	registerToggleLookupMongoDBCommand(context);
	registerClearMongoCacheCommand(context);
	registerOpenSettingsCommand(context);
}

export {
	registerAllCommands,
	registerReloadCommand,
	registerInitCommand,
	registerReconnectMongoDBCommand as registerReconnectMongoCommand,
	registerToggleLookupJsonDatabaseCommand,
	registerToggleLookupMongoDBCommand,
	registerClearMongoCacheCommand,
	registerOpenSettingsCommand,
};
