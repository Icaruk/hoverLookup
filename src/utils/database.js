import fs from "node:fs";
import path from "node:path";
import * as vscode from "vscode";

let database = {};
/** @type {string | string[]} */
let idField = ["id"]; // Now supports array of field names
let rawJsonData = null;
/** @type {Map<string, string>} Map of key to source file path */
const databaseSources = new Map();

/**
 * Check if JSON database is enabled
 * @returns {boolean}
 */
function isJsonDatabaseEnabled() {
	const config = vscode.workspace.getConfiguration("hoverLookup");
	return config.get("enableJsonDatabase") !== false; // Default to true
}

/**
 * Get the current database
 * @returns {Object}
 */
function getDatabase() {
	return database;
}

/**
 * Get the source file for a given key
 * @param {string} key
 * @returns {string | null}
 */
function getDatabaseSource(key) {
	return databaseSources.get(String(key)) || null;
}

/**
 * Get the current ID field(s)
 * @returns {string | string[]}
 */
function getIdField() {
	return idField;
}

/**
 * Get the raw JSON data
 * @returns {Object | null}
 */
function getRawJsonData() {
	return rawJsonData;
}

const DATABASE_RELOAD_TYPE = /** @type {const} */ ({
	INIT: "init",
	RELOAD: "reload",
	MANUAL_RELOAD: "manual_reload",
});

/**
 * Load database from JSON file(s)
 * @param {string | string[]} filePaths
 * @param {typeof DATABASE_RELOAD_TYPE[keyof typeof DATABASE_RELOAD_TYPE]} reloadType
 * @returns {boolean}
 */
function loadLocalDatabase(filePaths, reloadType = DATABASE_RELOAD_TYPE.INIT) {
	try {
		const paths = Array.isArray(filePaths) ? filePaths : [filePaths];

		if (paths.length === 0) {
			// Don't show error if using MongoDB only
			return false;
		}

		database = {};
		databaseSources.clear();
		let loadedAny = false;
		const invalidPaths = [];

		// Load databases in order, merging entries
		for (const filePath of paths) {
			if (!fs.existsSync(filePath)) {
				invalidPaths.push(filePath);
				continue;
			}

			const fileContent = fs.readFileSync(filePath, "utf8");
			const jsonData = JSON.parse(fileContent);
			rawJsonData = jsonData;
			const fileName = path.basename(filePath);

			if (Array.isArray(jsonData.data)) {
				// Determine which ID field(s) to use
				if (jsonData.idField) {
					idField = jsonData.idField;
				}

				// Normalize idField to array
				const idFields = Array.isArray(idField) ? idField : [idField];

				for (const item of jsonData.data) {
					// Try each ID field until we find a value
					for (const field of idFields) {
						const key = item[field];
						if (key !== undefined && key !== null) {
							// Only add if not already in database (first file wins)
							if (!(String(key) in database)) {
								database[String(key)] = item;
								databaseSources.set(String(key), fileName);
							}
							break; // Use the first valid field found
						}
					}
				}
				loadedAny = true;
			} else {
				// For flat JSON objects, add all keys
				for (const key in jsonData) {
					if (!(String(key) in database)) {
						database[String(key)] = jsonData[key];
						databaseSources.set(String(key), fileName);
					}
				}
				loadedAny = true;
			}
		}

		// Show warnings for invalid paths
		if (invalidPaths.length > 0) {
			const pathsList = invalidPaths.map((p) => `  • ${p}`).join("\n");
			vscode.window
				.showWarningMessage(
					`HoverLookup: ${invalidPaths.length} database file(s) not found:\n${pathsList}\n\nCheck your hoverLookup.databasePaths configuration.`,
					"Open Settings",
				)
				.then((selection) => {
					if (selection === "Open Settings") {
						vscode.commands.executeCommand(
							"workbench.action.openSettings",
							"hoverLookup.databasePaths",
						);
					}
				});
		}

		if (!loadedAny) {
			vscode.window.showErrorMessage(
				`No valid database files found. Use the "Initialize Database" command to create one.`,
			);
			return false;
		}

		if (reloadType === DATABASE_RELOAD_TYPE.MANUAL_RELOAD) {
			vscode.window.showInformationMessage("Database reloaded");
		}

		return true;
	} catch (error) {
		vscode.window.showErrorMessage(`Error loading database: ${error.message}`);

		return false;
	}
}

/**
 * Reindex database with new ID field(s)
 * @param {string | string[]} newIdField
 * @returns {boolean}
 */
function reindexDatabase(newIdField) {
	try {
		if (!rawJsonData || !Array.isArray(rawJsonData.data)) {
			vscode.window.showErrorMessage("No database loaded or invalid format");
			return false;
		}

		idField = newIdField;

		// Normalize idField to array
		const idFields = Array.isArray(idField) ? idField : [idField];

		database = {};

		for (const item of rawJsonData.data) {
			// Try each ID field until we find a value
			for (const field of idFields) {
				const key = item[field];
				if (key !== undefined && key !== null) {
					database[String(key)] = item;
					break; // Use the first valid field found
				}
			}
		}

		const count = Object.keys(database).length;
		const fieldDisplay = Array.isArray(idField)
			? `[${idField.join(", ")}]`
			: idField;
		vscode.window.showInformationMessage(
			`Database reindexed: ${count} entries (idField: ${fieldDisplay})`,
		);

		return true;
	} catch (error) {
		vscode.window.showErrorMessage(
			`Error reindexing database: ${error.message}`,
		);
		return false;
	}
}

/**
 * Get database file paths
 * @returns {string[]}
 */
function getDatabasePath() {
	const config = vscode.workspace.getConfiguration("hoverLookup");
	const configPaths = config.get("databasePaths");
	const paths = [];

	if (
		vscode.workspace.workspaceFolders &&
		vscode.workspace.workspaceFolders.length > 0
	) {
		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

		if (Array.isArray(configPaths) && configPaths.length > 0) {
			for (const configPath of configPaths) {
				if (path.isAbsolute(configPath)) {
					paths.push(configPath);
				} else {
					paths.push(path.join(workspaceRoot, configPath));
				}
			}
		} else {
			// Fallback to default
			paths.push(path.join(workspaceRoot, "lookup-database.json"));
		}
	}

	return paths;
}

/**
 * Load database from JSON files (MongoDB is queried on-demand)
 * @param {string | string[]} filePaths
 * @param {typeof DATABASE_RELOAD_TYPE[keyof typeof DATABASE_RELOAD_TYPE]} reloadType
 * @returns {Promise<boolean>}
 */
async function loadCombinedDatabase(
	filePaths,
	reloadType = DATABASE_RELOAD_TYPE.INIT,
) {
	try {
		// Load JSON files (MongoDB is now queried on-demand in hoverProvider)
		return loadLocalDatabase(filePaths, reloadType);
	} catch (error) {
		vscode.window.showErrorMessage(`Error loading database: ${error.message}`);
		return false;
	}
}

export {
	getDatabase,
	getDatabaseSource,
	getIdField,
	getRawJsonData,
	loadLocalDatabase as loadDatabase,
	loadCombinedDatabase,
	reindexDatabase,
	getDatabasePath,
	DATABASE_RELOAD_TYPE,
	isJsonDatabaseEnabled,
};
