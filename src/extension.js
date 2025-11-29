import * as vscode from "vscode";
import { LookupDebugAdapterTrackerFactory } from "./adapters/debugAdapter.js";
import {
	CONFIG_NAMESPACE,
	CONFIG_PROPS,
	STATE_KEYS,
	WINDOW_MESSAGES,
} from "./constants/config.js";
import { LookupHoverProvider } from "./providers/hoverProvider.js";
import { registerAllCommands } from "./utils/commands.js";
import { eventAffectsConfiguration } from "./utils/configuration.js";
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
				`HoverLookup: No collections defined. MongoDB will search in all collections, which may be slow. Consider configuring "${CONFIG_PROPS.MONGODB_COLLECTIONS}" for better performance.`,
				WINDOW_MESSAGES.OPEN_SETTINGS,
				WINDOW_MESSAGES.DONT_SHOW_AGAIN,
			)
			.then((selection) => {
				if (selection === WINDOW_MESSAGES.OPEN_SETTINGS) {
					vscode.commands.executeCommand(
						"workbench.action.openSettings",
						`@ext:Icaruk.${CONFIG_NAMESPACE} ${CONFIG_PROPS.MONGODB_COLLECTIONS}`,
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
			if (eventAffectsConfiguration.anyDatabase(event)) {
				// Reload JSON database if paths changed
				if (eventAffectsConfiguration.jsonDatabasePaths(event)) {
					const newDbPaths = getDatabasePath();
					if (newDbPaths && newDbPaths.length > 0) {
						loadCombinedDatabase(newDbPaths);
						setupFileWatchers(newDbPaths, context);
					}
				}

				// Reconnect MongoDB if MongoDB config changed
				if (eventAffectsConfiguration.mongoDb(event)) {
					console.log(
						"[HoverLookup] MongoDB configuration changed, reconnecting...",
					);
					await disconnectMongo();

					// Check if databases are configured but no collections
					if (eventAffectsConfiguration.mongoDbPaths(event)) {
						const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
						const databases = config.get(CONFIG_PROPS.MONGODB_DATABASES) || [];
						const collections =
							config.get(CONFIG_PROPS.MONGODB_COLLECTIONS) || [];

						if (databases.length > 0 && collections.length === 0) {
							vscode.window
								.showWarningMessage(
									`HoverLookup: No collections defined. MongoDB will search in all collections, which may be slow. Consider configuring "${CONFIG_PROPS.MONGODB_COLLECTIONS}" for better performance.`,
									WINDOW_MESSAGES.OPEN_SETTINGS,
								)
								.then((selection) => {
									if (selection === WINDOW_MESSAGES.OPEN_SETTINGS) {
										vscode.commands.executeCommand(
											"workbench.action.openSettings",
											`@ext:Icaruk.${CONFIG_NAMESPACE} ${CONFIG_PROPS.MONGODB_COLLECTIONS}`,
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
