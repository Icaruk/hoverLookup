import * as vscode from "vscode";
import { getDatabase } from "../utils/database.js";
import { searchMongoDatabase } from "../utils/mongoDatabase.js";
import {
	extractNumberAtPosition,
	extractStringAtPosition,
	getNumberRangeAtPosition,
	getStringRangeAtPosition,
} from "../utils/parser.js";
import {
	findVariableValue,
	getValueFromDebugger,
} from "../utils/variableResolver.js";
import { tooltipTitle } from "../utils/tooltip.js";

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

			const database = getDatabase();

			// Measure lookup time
			const lookupStart = performance.now();
			let result = database[word];
			let source = "lookup-database.json";
			let lookupTime = performance.now() - lookupStart;

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
					const variableLookupStart = performance.now();
					result = database[String(debugValue)];
					lookupTime += performance.now() - variableLookupStart;

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
				markdown.isTrusted = true;
				1;
				markdown.supportHtml = true;
				markdown.appendMarkdown(`---\n\n`);
				
				const _lookupTime = +lookupTime.toFixed(3);
				
				const titles = tooltipTitle({
					word,
					lookupTimeMs: _lookupTime,
					source,
				})
				
				for (const _title of titles) {
					markdown.appendMarkdown(_title);
				}
				
				markdown.appendCodeblock(JSON.stringify(result, null, 2), "json");

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
