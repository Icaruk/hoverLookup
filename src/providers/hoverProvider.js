import * as vscode from "vscode";
import { CONFIG_NAMESPACE, CONFIG_PROPS } from "../constants/config.js";
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
	extractObjectValues,
	findVariableValue,
	getValueFromDebugger,
} from "../utils/variableResolver.js";

/**
 * Get the maximum hover size from configuration
 * @returns {number} - Maximum size in characters
 */
function getMaxHoverSize() {
	const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
	return config.get(CONFIG_PROPS.MAX_HOVER_SIZE) || 5000;
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
		_preview: `${lines.join("\n")}\n  ...\n}`,
	};
}

/**
 * Search for a value in databases (JSON and MongoDB)
 * @param {string|number} searchValue - The value to search for
 * @returns {Promise<{result: any, source: string, lookupTime: number} | null>}
 */
async function searchInDatabases(searchValue) {
	let result = null;
	let source = null;
	let lookupTime = 0;

	// Try JSON database first if enabled
	if (isJsonDatabaseEnabled()) {
		const database = getDatabase();
		const lookupStart = performance.now();
		result = database[String(searchValue)];
		source = getDatabaseSource(String(searchValue));
		lookupTime = performance.now() - lookupStart;
	}

	// If not found in JSON database, search in MongoDB
	if (!result) {
		const mongoStart = performance.now();
		const mongoResult = await searchMongoDatabase(String(searchValue));
		lookupTime += performance.now() - mongoStart;
		if (mongoResult) {
			result = mongoResult.document;
			source = mongoResult.source;
		}
	}

	if (result) {
		return { result, source, lookupTime };
	}

	return null;
}

/**
 * Search using multiple values from an object
 * Tries each value sequentially until a match is found
 * @param {Array<string|number>} values - Array of values to search
 * @returns {Promise<{result: any, source: string, lookupTime: number, matchedValue: string|number} | null>}
 */
async function searchWithMultipleValues(values) {
	for (const value of values) {
		const searchResult = await searchInDatabases(value);
		if (searchResult) {
			return {
				...searchResult,
				matchedValue: value,
			};
		}
	}
	return null;
}

/**
 * Hover provider for normal code editing (without debugger)
 * Detects literals and variables, looks them up in the database
 */
class LookupHoverProvider {
	async provideHover(document, position) {
		try {
			// Check if debugger is active
			const isDebugging = vscode.debug.activeDebugSession !== undefined;
			if (isDebugging) {
				console.log(
					"[HoverLookup] HoverProvider called during debug session - this will work alongside DebugAdapter",
				);
			}

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
			let matchedValue = null;

			// First, try to search with the literal value (string or number)
			const literalSearch = await searchInDatabases(word);
			if (literalSearch) {
				result = literalSearch.result;
				source = literalSearch.source;
				lookupTime = literalSearch.lookupTime;
				matchedValue = word;
			}

			// If not found and it's a variable, resolve its value
			if (!result && isVariable) {
				console.log(`[HoverLookup] Resolving variable: ${word}`);
				let debugValue = await getValueFromDebugger(word);

				// If debugger is not active, try static analysis
				if (debugValue === null) {
					console.log(
						`[HoverLookup] Debugger not active, using static analysis`,
					);
					const variableValue = findVariableValue(
						document,
						word,
						position.line,
					);
					if (variableValue !== null) {
						debugValue = variableValue;
					}
				} else {
					console.log(
						`[HoverLookup] Got value from debugger: ${typeof debugValue} - ${JSON.stringify(debugValue).substring(0, 100)}`,
					);
				}

				if (debugValue !== null) {
					// Check if the value is an object
					if (typeof debugValue === "object" && debugValue !== null) {
						// Extract all values from the object
						const objectValues = extractObjectValues(debugValue);

						if (objectValues.length > 0) {
							console.log(
								`[HoverLookup] Object detected with ${objectValues.length} searchable values: ${JSON.stringify(objectValues)}`,
							);

							// Search with each value until we find a match
							const multiSearch = await searchWithMultipleValues(objectValues);
							if (multiSearch) {
								result = multiSearch.result;
								source = multiSearch.source;
								lookupTime += multiSearch.lookupTime;
								matchedValue = multiSearch.matchedValue;

								console.log(
									`[HoverLookup] Found match using object value: ${matchedValue}`,
								);
							}
						}
					} else {
						// It's a primitive value, search directly
						const valueSearch = await searchInDatabases(debugValue);
						if (valueSearch) {
							result = valueSearch.result;
							source = valueSearch.source;
							lookupTime += valueSearch.lookupTime;
							matchedValue = debugValue;
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

				// Only pass matchedValue if it's different from word (i.e., it's from an object)
				const headerMatchedValue =
					matchedValue !== null && matchedValue !== word
						? matchedValue
						: undefined;

				// Header with separator
				const header = formatTooltipHeaderMarkdown({
					word,
					lookupTimeMs: _lookupTime,
					source,
					matchedValue: headerMatchedValue,
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
