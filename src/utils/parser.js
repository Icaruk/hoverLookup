const vscode = require("vscode");

/**
 * Extract string at cursor position
 * @param {string} line
 * @param {number} character
 * @returns {string | null}
 */
function extractStringAtPosition(line, character) {
	const patterns = [
		/["']([^"'\\]*(\\.[^"'\\]*)*)["']/g,
		/`([^`\\]*(\\.[^`\\]*)*)`/g,
	];

	for (const regex of patterns) {
		regex.lastIndex = 0;
		let match = regex.exec(line);

		while (match !== null) {
			const start = match.index + 1;
			const end = match.index + match[0].length - 1;

			if (character >= start && character < end) {
				return match[1];
			}

			match = regex.exec(line);
		}
	}

	return null;
}

/**
 * Extract number at cursor position
 * @param {string} line
 * @param {number} character
 * @returns {number | null}
 */
function extractNumberAtPosition(line, character) {
	const numberRegex = /-?\d+\.?\d*/g;
	let match = numberRegex.exec(line);

	while (match !== null) {
		const start = match.index;
		const end = match.index + match[0].length;

		if (character >= start && character < end) {
			const numStr = match[0];
			return numStr.includes(".") ? parseFloat(numStr) : parseInt(numStr, 10);
		}

		match = numberRegex.exec(line);
	}

	return null;
}

/**
 * Get range of number at cursor position
 * @param {vscode.Position} position
 * @param {string} line
 * @param {number} character
 * @returns {vscode.Range | null}
 */
function getNumberRangeAtPosition(position, line, character) {
	const numberRegex = /-?\d+\.?\d*/g;
	let match = numberRegex.exec(line);

	while (match !== null) {
		const start = match.index;
		const end = match.index + match[0].length;

		if (character >= start && character < end) {
			return new vscode.Range(position.line, start, position.line, end);
		}

		match = numberRegex.exec(line);
	}

	return null;
}

/**
 * Get range of string at cursor position
 * @param {vscode.Position} position
 * @param {string} line
 * @param {number} character
 * @returns {vscode.Range | null}
 */
function getStringRangeAtPosition(position, line, character) {
	const patterns = [
		/["']([^"'\\]*(\\.[^"'\\]*)*)["']/g,
		/`([^`\\]*(\\.[^`\\]*)*)`/g,
	];

	for (const regex of patterns) {
		regex.lastIndex = 0;
		let match = regex.exec(line);

		while (match !== null) {
			const start = match.index;
			const end = match.index + match[0].length;

			if (character >= start && character < end) {
				return new vscode.Range(position.line, start, position.line, end);
			}

			match = regex.exec(line);
		}
	}

	return null;
}

module.exports = {
	extractStringAtPosition,
	extractNumberAtPosition,
	getNumberRangeAtPosition,
	getStringRangeAtPosition,
};
