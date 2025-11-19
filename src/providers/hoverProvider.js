const vscode = require("vscode");
const { getDatabase } = require("../utils/database");
const {
	extractStringAtPosition,
	extractNumberAtPosition,
	getNumberRangeAtPosition,
	getStringRangeAtPosition,
} = require("../utils/parser");
const {
	getValueFromDebugger,
	findVariableValue,
} = require("../utils/variableResolver");

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
			let lookupTime = performance.now() - lookupStart;

			if (!result && isVariable) {
				const debugValue = await getValueFromDebugger(word);
				if (debugValue !== null) {
					const variableLookupStart = performance.now();
					result = database[String(debugValue)];
					lookupTime += performance.now() - variableLookupStart;
				}

				if (!result && debugValue === null) {
					const variableValue = findVariableValue(
						document,
						word,
						position.line,
					);
					if (variableValue !== null) {
						const variableLookupStart = performance.now();
						result = database[String(variableValue)];
						lookupTime += performance.now() - variableLookupStart;
					}
				}
			}

			if (result) {
				console.log(
					`[HoverLookup] Lookup for "${word}": ${lookupTime.toFixed(3)}ms`,
				);

				const markdown = new vscode.MarkdownString();
				markdown.isTrusted = true;
				markdown.supportHtml = true;
				markdown.appendMarkdown(`---\n\n`);
				markdown.appendMarkdown(
					`**🔍 Database Lookup for \`${word}\`** ⏱️ \`${lookupTime.toFixed(3)}ms\`\n\n`,
				);
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

module.exports = {
	LookupHoverProvider,
};
