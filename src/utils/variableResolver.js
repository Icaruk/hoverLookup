const vscode = require("vscode");

/**
 * Get variable value from active debugger
 * @param {string} expression
 * @returns {Promise<string | number | null>}
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
 * @returns {string | number | boolean | null}
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

module.exports = {
	getValueFromDebugger,
	findVariableValue,
};
