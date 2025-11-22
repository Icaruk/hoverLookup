import * as vscode from "vscode";
import { LookupDebugAdapterTrackerFactory } from "./adapters/debugAdapter.js";
import {
	CONFIG_KEYS,
	CONFIG_NAMESPACE,
	CONFIG_PROPS,
	STATE_KEYS,
	WINDOW_MESSAGES,
} from "./constants/config.js";
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
	const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
	const databases = config.get(CONFIG_PROPS.MONGODB_DATABASES) || [];
	const collections = config.get(CONFIG_PROPS.MONGODB_COLLECTIONS) || [];
	const hideWarning = context.globalState.get(
		STATE_KEYS.HIDE_COLLECTIONS_WARNING,
		false,
	);

	if (databases.length > 0 && collections.length === 0 && !hideWarning) {
		vscode.window
			.showWarningMessage(
				"HoverLookup: No collections defined. MongoDB will search in all collections, which may be slow. Consider configuring 'mongodbCollections' for better performance.",
				WINDOW_MESSAGES.OPEN_SETTINGS,
				WINDOW_MESSAGES.DONT_SHOW_AGAIN,
			)
			.then((selection) => {
				if (selection === WINDOW_MESSAGES.OPEN_SETTINGS) {
					vscode.commands.executeCommand(
						"workbench.action.openSettings",
						"@ext:Icaruk.hoverlookup mongodbCollections",
					);
				} else if (selection === WINDOW_MESSAGES.DONT_SHOW_AGAIN) {
					// Store a flag to not show this warning again
					context.globalState.update(STATE_KEYS.HIDE_COLLECTIONS_WARNING, true);
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
				event.affectsConfiguration(CONFIG_KEYS.DATABASE_PATHS) ||
				event.affectsConfiguration(CONFIG_KEYS.MONGODB_URL) ||
				event.affectsConfiguration(CONFIG_KEYS.MONGODB_COLLECTIONS) ||
				event.affectsConfiguration(CONFIG_KEYS.MONGODB_DATABASES)
			) {
				// Reload JSON database if paths changed
				if (event.affectsConfiguration(CONFIG_KEYS.DATABASE_PATHS)) {
					const newDbPaths = getDatabasePath();
					if (newDbPaths && newDbPaths.length > 0) {
						loadCombinedDatabase(newDbPaths);
						setupFileWatchers(newDbPaths, context);
					}
				}

				// Reconnect MongoDB if MongoDB config changed
				if (
					event.affectsConfiguration(CONFIG_KEYS.MONGODB_URL) ||
					event.affectsConfiguration(CONFIG_KEYS.MONGODB_COLLECTIONS) ||
					event.affectsConfiguration(CONFIG_KEYS.MONGODB_DATABASES)
				) {
					console.log(
						"[HoverLookup] MongoDB configuration changed, reconnecting...",
					);
					await disconnectMongo();

					// Check if databases are configured but no collections
					if (event.affectsConfiguration(CONFIG_KEYS.MONGODB_DATABASES)) {
						const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
						const databases = config.get(CONFIG_PROPS.MONGODB_DATABASES) || [];
						const collections =
							config.get(CONFIG_PROPS.MONGODB_COLLECTIONS) || [];

						if (databases.length > 0 && collections.length === 0) {
							vscode.window
								.showWarningMessage(
									"HoverLookup: No collections defined. MongoDB will search in all collections, which may be slow. Consider configuring 'mongodbCollections' for better performance.",
									WINDOW_MESSAGES.OPEN_SETTINGS,
								)
								.then((selection) => {
									if (selection === WINDOW_MESSAGES.OPEN_SETTINGS) {
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
