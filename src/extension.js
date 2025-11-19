// ============================================================================
// IMPORTS
// ============================================================================
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

// ============================================================================
// ACTIVATION
// ============================================================================

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
	const configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
		if (
			event.affectsConfiguration("hoverLookup.databasePaths") ||
			event.affectsConfiguration("hoverLookup.mongodbUrl") ||
			event.affectsConfiguration("hoverLookup.mongodbCollections") ||
			event.affectsConfiguration("hoverLookup.mongodbDatabases")
		) {
			const newDbPaths = getDatabasePath();
			if (newDbPaths && newDbPaths.length > 0) {
				loadCombinedDatabase(newDbPaths);
				setupFileWatchers(newDbPaths, context);
			}
			vscode.window.showInformationMessage(
				"HoverLookup: Configuration reloaded",
			);
		}
	});

	// Add providers to subscriptions
	context.subscriptions.push(hoverProvider, debugTrackerFactory, configWatcher);
}

async function deactivate() {
	await disconnectMongo();
}

export { activate, deactivate };
