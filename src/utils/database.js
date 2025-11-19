const vscode = require("vscode");
const fs = require("node:fs");
const path = require("node:path");

let database = {};
/** @type {string | string[]} */
let idField = ["id"]; // Now supports array of field names
let manualIdField = null;
let rawJsonData = null;

/**
 * Get the current database
 * @returns {Object}
 */
function getDatabase() {
	return database;
}

/**
 * Get the current ID field(s)
 * @returns {string | string[]}
 */
function getIdField() {
	return idField;
}

/**
 * Get the manual ID field
 * @returns {string | string[] | null}
 */
function getManualIdField() {
	return manualIdField;
}

/**
 * Set the manual ID field
 * @param {string | string[] | null} field
 */
function setManualIdField(field) {
	manualIdField = field;
}

/**
 * Get the raw JSON data
 * @returns {Object | null}
 */
function getRawJsonData() {
	return rawJsonData;
}

/**
 * Load database from JSON file
 * @param {string} filePath
 * @param {boolean} useManualIdField
 * @returns {boolean}
 */
function loadDatabase(filePath, useManualIdField = false) {
	try {
		if (!fs.existsSync(filePath)) {
			vscode.window.showErrorMessage(`Database file not found: ${filePath}`);
			return false;
		}

		const fileContent = fs.readFileSync(filePath, "utf8");
		const jsonData = JSON.parse(fileContent);
		rawJsonData = jsonData;

		if (Array.isArray(jsonData.data)) {
			// Determine which ID field(s) to use
			if (useManualIdField && manualIdField) {
				idField = manualIdField;
			} else if (jsonData.idField) {
				idField = jsonData.idField;
			}

			// Normalize idField to array
			const idFields = Array.isArray(idField) ? idField : [idField];

			database = {};
			for (const item of jsonData.data) {
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
			const manualNote =
				useManualIdField && manualIdField ? " (manual override)" : "";
			const fieldDisplay = Array.isArray(idField)
				? `[${idField.join(", ")}]`
				: idField;
			vscode.window.showInformationMessage(
				`Lookup database loaded: ${count} entries (idField: ${fieldDisplay})${manualNote}`,
			);
		} else {
			database = jsonData;
			const count = Object.keys(database).length;
			vscode.window.showInformationMessage(
				`Lookup database loaded: ${count} entries`,
			);
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
 * Get database file path
 * @returns {string | null}
 */
function getDatabasePath() {
	const config = vscode.workspace.getConfiguration("hoverLookup");
	const configPath = config.get("databasePath");

	if (configPath) {
		if (path.isAbsolute(configPath)) {
			return configPath;
		}
		if (
			vscode.workspace.workspaceFolders &&
			vscode.workspace.workspaceFolders.length > 0
		) {
			return path.join(
				vscode.workspace.workspaceFolders[0].uri.fsPath,
				configPath,
			);
		}
	}

	if (
		vscode.workspace.workspaceFolders &&
		vscode.workspace.workspaceFolders.length > 0
	) {
		return path.join(
			vscode.workspace.workspaceFolders[0].uri.fsPath,
			"lookup-database.json",
		);
	}

	return null;
}

module.exports = {
	getDatabase,
	getIdField,
	getManualIdField,
	setManualIdField,
	getRawJsonData,
	loadDatabase,
	reindexDatabase,
	getDatabasePath,
};
