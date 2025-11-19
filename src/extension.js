import * as vscode from "vscode";
import { LookupDebugAdapterTrackerFactory } from "./adapters/debugAdapter.js";
import { LookupHoverProvider } from "./providers/hoverProvider.js";
import { registerAllCommands } from "./utils/commands.js";
import {
	getDatabasePath,
	loadCombinedDatabase,
	loadDatabase,
} from "./utils/database.js";
import { disconnectMongo } from "./utils/mongoDatabase.js";

// Store watchers to clean them up when configuration changes
let fileWatchers = [];

/**
 * Setup file watchers for database files
 * @param {string[]} dbPaths
 * @param {vscode.ExtensionContext} context
 */
function setupFileWatchers(dbPaths, context) {
	// Clean up existing watchers
	for (const watcher of fileWatchers) {
		watcher.dispose();
	}
	fileWatchers = [];

	// Create new watchers
	if (dbPaths && dbPaths.length > 0) {
		for (const dbPath of dbPaths) {
			const watcher = vscode.workspace.createFileSystemWatcher(dbPath);
			watcher.onDidChange(() => {
				loadDatabase(dbPaths);
			});
			fileWatchers.push(watcher);
			context.subscriptions.push(watcher);
		}
	}
}

/**
 * Activate the extension
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	// Load database on activation
	const dbPaths = getDatabasePath();
	if (dbPaths && dbPaths.length > 0) {
		loadCombinedDatabase(dbPaths);
	}
	// Note: If no JSON files are configured, MongoDB will be queried on-demand

	// Check MongoDB configuration on activation
	const config = vscode.workspace.getConfiguration("hoverLookup");
	const databases = config.get("mongodbDatabases") || [];
	const collections = config.get("mongodbCollections") || [];
	const hideWarning = context.globalState.get(
		"hoverLookup.hideCollectionsWarning",
		false,
	);

	if (databases.length > 0 && collections.length === 0 && !hideWarning) {
		vscode.window
			.showWarningMessage(
				"HoverLookup: No collections defined. MongoDB will search in all collections, which may be slow. Consider configuring 'mongodbCollections' for better performance.",
				"Open Settings",
				"Don't show again",
			)
			.then((selection) => {
				if (selection === "Open Settings") {
					vscode.commands.executeCommand(
						"workbench.action.openSettings",
						"@ext:Icaruk.hoverlookup mongodbCollections",
					);
				} else if (selection === "Don't show again") {
					// Store a flag to not show this warning again
					context.globalState.update(
						"hoverLookup.hideCollectionsWarning",
						true,
					);
				}
			});
	}

	// Register hover provider
	const hoverProvider = vscode.languages.registerHoverProvider(
		{ scheme: "*", language: "*" },
		new LookupHoverProvider(),
	);

	// Register debug adapter tracker
	const debugTrackerFactory = vscode.debug.registerDebugAdapterTrackerFactory(
		"*",
		new LookupDebugAdapterTrackerFactory(),
	);

	// Register all commands
	registerAllCommands(context);

	// Setup file watchers
	setupFileWatchers(dbPaths, context);

	// Watch for configuration changes
	const configWatcher = vscode.workspace.onDidChangeConfiguration(
		async (event) => {
			if (
				event.affectsConfiguration("hoverLookup.databasePaths") ||
				event.affectsConfiguration("hoverLookup.mongodbUrl") ||
				event.affectsConfiguration("hoverLookup.mongodbCollections") ||
				event.affectsConfiguration("hoverLookup.mongodbDatabases")
			) {
				// Reload JSON database if paths changed
				if (event.affectsConfiguration("hoverLookup.databasePaths")) {
					const newDbPaths = getDatabasePath();
					if (newDbPaths && newDbPaths.length > 0) {
						loadCombinedDatabase(newDbPaths);
						setupFileWatchers(newDbPaths, context);
					}
				}

				// Reconnect MongoDB if MongoDB config changed
				if (
					event.affectsConfiguration("hoverLookup.mongodbUrl") ||
					event.affectsConfiguration("hoverLookup.mongodbCollections") ||
					event.affectsConfiguration("hoverLookup.mongodbDatabases")
				) {
					console.log(
						"[HoverLookup] MongoDB configuration changed, reconnecting...",
					);
					await disconnectMongo();

					// Check if databases are configured but no collections
					if (event.affectsConfiguration("hoverLookup.mongodbDatabases")) {
						const config = vscode.workspace.getConfiguration("hoverLookup");
						const databases = config.get("mongodbDatabases") || [];
						const collections = config.get("mongodbCollections") || [];

						if (databases.length > 0 && collections.length === 0) {
							vscode.window
								.showWarningMessage(
									"HoverLookup: No collections defined. MongoDB will search in all collections, which may be slow. Consider configuring 'mongodbCollections' for better performance.",
									"Open Settings",
								)
								.then((selection) => {
									if (selection === "Open Settings") {
										vscode.commands.executeCommand(
											"workbench.action.openSettings",
											"@ext:Icaruk.hoverlookup mongodbCollections",
										);
									}
								});
						}
					}

					vscode.window.showInformationMessage(
						"HoverLookup: MongoDB configuration reloaded. Connection will be re-established on next lookup.",
					);
				} else {
					vscode.window.showInformationMessage(
						"HoverLookup: Configuration reloaded",
					);
				}
			}
		},
	);

	// Add providers to subscriptions
	context.subscriptions.push(hoverProvider, debugTrackerFactory, configWatcher);
}

async function deactivate() {
	await disconnectMongo();
}

export { activate, deactivate };
