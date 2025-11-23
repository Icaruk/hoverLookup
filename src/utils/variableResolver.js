import * as vscode from "vscode";

/**
 * Try to parse a value as JSON object
 * @param {string} value - The value to parse
 * @returns {Object | null} - Parsed object or null if not valid JSON
 */
function tryParseObject(value) {
	try {
		// Remove quotes if present
		let cleanValue = value;
		if (typeof cleanValue === "string") {
			cleanValue = cleanValue.trim();

			// Try to parse as JSON first
			try {
				const parsed = JSON.parse(cleanValue);
				if (
					typeof parsed === "object" &&
					parsed !== null &&
					!Array.isArray(parsed)
				) {
					return parsed;
				}
			} catch (_jsonError) {
				// If JSON.parse fails, try to convert JavaScript object notation to JSON
				// 1. Remove trailing commas before closing braces/brackets
				let jsonLike = cleanValue.replace(/,(\s*[}\]])/g, "$1");

				// 2. Replace unquoted keys with quoted keys: {name: "value"} -> {"name": "value"}
				jsonLike = jsonLike.replace(/(\w+):/g, '"$1":');

				// 3. Replace single quotes with double quotes
				jsonLike = jsonLike.replace(/'/g, '"');

				try {
					const parsed = JSON.parse(jsonLike);
					if (
						typeof parsed === "object" &&
						parsed !== null &&
						!Array.isArray(parsed)
					) {
						console.log(
							`[HoverLookup] tryParseObject: Successfully parsed JavaScript object`,
						);
						return parsed;
					}
				} catch (convertError) {
					console.log(
						`[HoverLookup] tryParseObject: Failed to parse - ${convertError.message}`,
					);
					console.log(
						`[HoverLookup] tryParseObject: Attempted to parse: ${jsonLike.substring(0, 200)}`,
					);
				}
			}
		}
		return null;
	} catch (_error) {
		return null;
	}
}

/**
 * Capture a multi-line object from the document
 * @param {vscode.TextDocument} document
 * @param {number} startLine - Line where the object starts
 * @param {number} startChar - Character position where '{' is found
 * @returns {string} - The complete object as a string
 */
function captureMultiLineObject(document, startLine, startChar) {
	let braceCount = 0;
	let objectStr = "";
	let foundStart = false;

	// Start from the line where the object begins
	for (let i = startLine; i < document.lineCount; i++) {
		const lineText = document.lineAt(i).text;
		const startPos = i === startLine ? startChar : 0;

		for (let j = startPos; j < lineText.length; j++) {
			const char = lineText[j];
			objectStr += char;

			if (char === "{") {
				braceCount++;
				foundStart = true;
			} else if (char === "}") {
				braceCount--;
				if (foundStart && braceCount === 0) {
					// Found the closing brace
					return objectStr.trim();
				}
			}
		}

		// Add newline if we're continuing to the next line
		if (braceCount > 0) {
			objectStr += "\n";
		}

		// Safety limit: don't go beyond 50 lines
		if (i - startLine > 50) {
			break;
		}
	}

	return objectStr.trim();
}

/**
 * Extract all searchable values from an object
 * @param {Object} obj - The object to extract values from
 * @returns {Array<string|number>} - Array of searchable values
 */
function extractObjectValues(obj) {
	const values = [];

	for (const key in obj) {
		if (Object.hasOwn(obj, key)) {
			const value = obj[key];

			// Only include primitive values (strings, numbers)
			if (typeof value === "string" || typeof value === "number") {
				values.push(value);
			}
		}
	}

	return values;
}

/**
 * Get variable value from active debugger
 * @param {string} expression
 * @returns {Promise<string | number | Object | null>}
 */
async function getValueFromDebugger(expression) {
	try {
		const activeSession = vscode.debug.activeDebugSession;
		if (!activeSession) {
			return null;
		}

		const reply = await activeSession.customRequest("evaluate", {
			expression: expression,
			frameId: 0,
			context: "hover",
		});

		if (reply && reply.result !== undefined) {
			const value = reply.result;

			if (typeof value === "string") {
				// Try to parse as object first
				const parsedObject = tryParseObject(value);
				if (parsedObject) {
					return parsedObject;
				}

				const stringMatch = value.match(/^['"](.*)['"]$/);
				if (stringMatch) {
					return stringMatch[1];
				}

				if (/^-?\d+\.?\d*$/.test(value)) {
					return value.includes(".") ? parseFloat(value) : parseInt(value, 10);
				}

				return value;
			}

			if (typeof value === "number") {
				return value;
			}

			// If it's already an object, return it
			if (typeof value === "object" && value !== null) {
				return value;
			}

			return String(value);
		}

		return null;
	} catch (_error) {
		return null;
	}
}

/**
 * Find variable value in document using static analysis
 * @param {vscode.TextDocument} document
 * @param {string} variableName
 * @param {number} currentLine
 * @returns {string | number | boolean | object | null}
 */
function findVariableValue(document, variableName, currentLine) {
	try {
		for (let i = currentLine; i >= 0; i--) {
			const lineText = document.lineAt(i).text;

			const patterns = [
				new RegExp(
					`(?:const|let|var)\\s+${variableName}\\s*=\\s*([^;,\\n]+)`,
					"i",
				),
				new RegExp(`^\\s*${variableName}\\s*=\\s*([^;,\\n]+)`, "i"),
				new RegExp(`${variableName}\\s*[=:]\\s*([^;,\\n}]+)`, "i"),
			];

			for (const pattern of patterns) {
				const match = lineText.match(pattern);
				if (match) {
					let value = match[1].trim();

					// If value starts with '{', try to capture multi-line object
					if (value.startsWith("{")) {
						value = captureMultiLineObject(
							document,
							i,
							lineText.indexOf("{", lineText.indexOf("=")),
						);
						console.log(
							`[HoverLookup] Captured multi-line object: ${value.substring(0, 100)}...`,
						);
					}

					value = value.replace(/[,;].*$/, "").trim();

					const stringMatch = value.match(/^["'`]([^"'`]+)["'`]$/);
					if (stringMatch) {
						return stringMatch[1];
					}

					const numberMatch = value.match(/^-?\d+\.?\d*$/);
					if (numberMatch) {
						return value.includes(".")
							? parseFloat(value)
							: parseInt(value, 10);
					}

					if (value === "true" || value === "false") {
						return value === "true";
					}

					// Try to parse as object
					const parsedObject = tryParseObject(value);
					if (parsedObject) {
						console.log(
							`[HoverLookup] findVariableValue: Parsed object with ${Object.keys(parsedObject).length} keys`,
						);
						return parsedObject;
					}

					if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value)) {
						return findVariableValue(document, value, i - 1);
					}

					return value;
				}
			}
		}

		return null;
	} catch (_error) {
		return null;
	}
}

export {
	getValueFromDebugger,
	findVariableValue,
	tryParseObject,
	extractObjectValues,
};
