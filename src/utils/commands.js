import fs from "node:fs";
import path from "node:path";
import * as vscode from "vscode";
import {
	DATABASE_RELOAD_TYPE,
	getDatabasePath,
	getIdField,
	getRawJsonData,
	loadDatabase,
	reindexDatabase,
} from "./database.js";

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
 * Register the change ID field command
 * @param {vscode.ExtensionContext} context
 */
function registerChangeIdFieldCommand(context) {
	const changeIdFieldCommand = vscode.commands.registerCommand(
		"hoverLookup.changeIdField",
		async () => {
			const currentIdField = getIdField();
			const currentDisplay = Array.isArray(currentIdField)
				? currentIdField.join(", ")
				: currentIdField;

			const newIdField = await vscode.window.showInputBox({
				prompt:
					"Enter field name(s) to use as ID for lookups (comma-separated for multiple)",
				value: currentDisplay,
				placeHolder: "e.g., id, userId, code OR id, code, sku",
			});

			if (newIdField && newIdField.trim() !== "") {
				// Parse input: split by comma and trim each field
				const fields = newIdField
					.split(",")
					.map((f) => f.trim())
					.filter((f) => f !== "");

				// Use array if multiple fields, single string if only one
				const parsedIdField = fields.length === 1 ? fields[0] : fields;

				const success = reindexDatabase(parsedIdField);

				if (success) {
					const dbPaths = getDatabasePath();
					const rawJsonData = getRawJsonData();
					if (dbPaths && dbPaths.length > 0 && rawJsonData) {
						try {
							rawJsonData.idField = parsedIdField;
							const updatedJson = JSON.stringify(rawJsonData, null, 2);
							// Update the first database file
							fs.writeFileSync(dbPaths[0], updatedJson, "utf8");
						} catch (error) {
							vscode.window.showWarningMessage(
								`ID field changed in memory but couldn't update file: ${error.message}`,
							);
						}
					}
				}
			}
		},
	);

	context.subscriptions.push(changeIdFieldCommand);
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
 * Register all commands
 * @param {vscode.ExtensionContext} context
 */
function registerAllCommands(context) {
	registerReloadCommand(context);
	registerChangeIdFieldCommand(context);
	registerInitCommand(context);
}

export {
	registerAllCommands,
	registerReloadCommand,
	registerChangeIdFieldCommand,
	registerInitCommand,
};
