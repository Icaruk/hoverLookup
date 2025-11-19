import * as vscode from "vscode";
import {
	getDatabase,
	getDatabaseSource,
	isJsonDatabaseEnabled,
} from "../utils/database.js";
import { searchMongoDatabase } from "../utils/mongoDatabase.js";
import {
	extractNumberAtPosition,
	extractStringAtPosition,
	getNumberRangeAtPosition,
	getStringRangeAtPosition,
} from "../utils/parser.js";
import { formatTooltipHeaderMarkdown } from "../utils/tooltip.js";
import {
	findVariableValue,
	getValueFromDebugger,
} from "../utils/variableResolver.js";

/**
 * Get the maximum hover size from configuration
 * @returns {number} - Maximum size in characters
 */
function getMaxHoverSize() {
	const config = vscode.workspace.getConfiguration("hoverLookup");
	return config.get("maxHoverSize") || 5000;
}

/**
 * Truncate large objects to prevent "414 URI Too Long" errors
 * @param {any} obj - The object to truncate
 * @param {number} maxLength - Maximum string length (default: from config or 5000 characters)
 * @returns {any} - Truncated object or original if small enough
 */
function truncateLargeObject(obj, maxLength = null) {
	const maxSize = maxLength || getMaxHoverSize();
	const jsonString = JSON.stringify(obj, null, 2);

	if (jsonString.length <= maxSize) {
		return obj;
	}

	// If too large, create a truncated version
	const truncated = JSON.stringify(obj, null, 2).substring(0, maxSize);
	const lines = truncated.split("\n");

	// Remove the last incomplete line
	lines.pop();

	return {
		_truncated: true,
		_originalSize: jsonString.length,
		_message: `⚠️ Document too large (${jsonString.length} chars). Showing first ${maxSize} characters.`,
		_preview: lines.join("\n") + "\n  ...\n}",
	};
}

/**
 * Hover provider for normal code editing (without debugger)
 * Detects literals and variables, looks them up in the database
 */
class LookupHoverProvider {
	async provideHover(document, position) {
		try {
			const line = document.lineAt(position.line).text;
			const char = position.character;

			let word = null;
			let isVariable = false;
			let hoverRange = null;

			const stringMatch = extractStringAtPosition(line, char);
			if (stringMatch) {
				word = stringMatch;
				hoverRange = getStringRangeAtPosition(position, line, char);
			} else {
				const numberMatch = extractNumberAtPosition(line, char);
				if (numberMatch !== null) {
					word = String(numberMatch);
					hoverRange = getNumberRangeAtPosition(position, line, char);
				} else {
					const range = document.getWordRangeAtPosition(position, /\w+/);
					if (range) {
						word = document.getText(range);
						isVariable = true;
						hoverRange = range;
					}
				}
			}

			if (!word) {
				return null;
			}

			let result = null;
			let source = null;
			let lookupTime = 0;

			// Try JSON database first if enabled
			if (isJsonDatabaseEnabled()) {
				const database = getDatabase();
				const lookupStart = performance.now();
				result = database[word];
				source = getDatabaseSource(word);
				lookupTime = performance.now() - lookupStart;
			}

			// If not found in JSON database, search in MongoDB
			if (!result) {
				const mongoStart = performance.now();
				const mongoResult = await searchMongoDatabase(word);
				lookupTime += performance.now() - mongoStart;
				if (mongoResult) {
					result = mongoResult.document;
					source = mongoResult.source;
				}
			}

			if (!result && isVariable) {
				let debugValue = await getValueFromDebugger(word);

				// If debugger is not active, try static analysis
				if (debugValue === null) {
					const variableValue = findVariableValue(
						document,
						word,
						position.line,
					);
					if (variableValue !== null) {
						debugValue = String(variableValue);
					}
				}

				if (debugValue !== null) {
					// Try JSON database first if enabled
					if (isJsonDatabaseEnabled()) {
						const database = getDatabase();
						const variableLookupStart = performance.now();
						result = database[String(debugValue)];
						source = getDatabaseSource(String(debugValue));
						lookupTime += performance.now() - variableLookupStart;
					}

					// If not found in JSON database, search in MongoDB
					if (!result) {
						const mongoStart = performance.now();
						const mongoResult = await searchMongoDatabase(String(debugValue));
						lookupTime += performance.now() - mongoStart;
						if (mongoResult) {
							result = mongoResult.document;
							source = mongoResult.source;
						}
					}
				}
			}

			if (result) {
				console.log(
					`[HoverLookup] Lookup for "${word}": ${lookupTime.toFixed(3)}ms (from ${source})`,
				);

				const markdown = new vscode.MarkdownString();
				// Security: We don't need isTrusted or supportHtml since we only use basic markdown
				// markdown.isTrusted = true;
				// markdown.supportHtml = true;

				const _lookupTime = +lookupTime.toFixed(3);

				// Header with separator
				const header = formatTooltipHeaderMarkdown({
					word,
					lookupTimeMs: _lookupTime,
					source,
				});
				markdown.appendMarkdown(header);

				// Truncate large objects to prevent "414 URI Too Long" errors
				const displayResult = truncateLargeObject(result);

				// If truncated, show warning message
				if (displayResult._truncated) {
					markdown.appendMarkdown(`${displayResult._message}\n\n`);
					markdown.appendCodeblock(displayResult._preview, "json");
				} else {
					markdown.appendCodeblock(JSON.stringify(result, null, 2), "json");
				}

				const hover = hoverRange
					? new vscode.Hover(markdown, hoverRange)
					: new vscode.Hover(markdown);
				return hover;
			}

			return null;
		} catch (_error) {
			return null;
		}
	}
}

export { LookupHoverProvider };
