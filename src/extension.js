// ============================================================================
// IMPORTS
// ============================================================================
const vscode = require("vscode");
const { loadDatabase, getDatabasePath } = require("./utils/database");
const { LookupHoverProvider } = require("./providers/hoverProvider");
const { LookupDebugAdapterTrackerFactory } = require("./adapters/debugAdapter");
const { registerAllCommands } = require("./utils/commands");

// ============================================================================
// ACTIVATION
// ============================================================================

/**
 * Activate the extension
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	// Load database on activation
	const dbPath = getDatabasePath();
	if (dbPath) {
		loadDatabase(dbPath);
	} else {
		vscode.window.showWarningMessage(
			"HoverLookup: No workspace found. Please open a folder and create a lookup-database.json file.",
		);
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

	// Watch for database file changes
	if (dbPath) {
		const watcher = vscode.workspace.createFileSystemWatcher(dbPath);
		watcher.onDidChange(() => {
			loadDatabase(dbPath);
		});
		context.subscriptions.push(watcher);
	}

	// Add providers to subscriptions
	context.subscriptions.push(hoverProvider, debugTrackerFactory);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate,
};
