/**
 * Create a separator line
 * @param {number} length - Length of the separator (default: 50)
 * @returns {string}
 */
function createSeparator(length = 50) {
	return "─".repeat(length);
}

/**
 * Format tooltip header for markdown (hover provider)
 * @param {Object} params
 * @param {string} params.word The word being hovered
 * @param {number} params.lookupTimeMs The time it took to perform the lookup
 * @param {string} params.source The source of the data (e.g., "lookup-database.json")
 * @param {string|number} [params.matchedValue] The value that matched (for objects)
 * @returns {string}
 */
export function formatTooltipHeaderMarkdown({
	word,
	lookupTimeMs,
	source,
	matchedValue,
}) {
	const separator = createSeparator();
	let matchInfo = "";
	if (matchedValue !== undefined && matchedValue !== null) {
		matchInfo = `Matched using: \`${matchedValue}\`\n\n`;
	}
	return `${separator}\n\n**🔍 Database Lookup for \`${word}\`** (${lookupTimeMs}ms)\n\nSource: \`${source}\`\n${matchInfo}\n${separator}\n\n`;
}

/**
 * Format tooltip header for plain text (debug adapter)
 * @param {Object} params
 * @param {number} params.lookupTimeMs The time it took to perform the lookup
 * @param {string} params.source The source of the data (e.g., "lookup-database.json")
 * @param {string|number} [params.matchedValue] The value that matched (for objects)
 * @returns {string}
 */
export function formatTooltipHeaderPlainText({
	lookupTimeMs,
	source,
	matchedValue,
}) {
	const separator = createSeparator();
	let matchInfo = "";
	if (matchedValue !== undefined && matchedValue !== null) {
		matchInfo = `Matched using: ${matchedValue}\n`;
	}
	return `\n\n${separator}\n🔍 Database Lookup (${lookupTimeMs}ms)\nSource: ${source}\n${matchInfo}${separator}\n\n`;
}

/**
 * @deprecated Use formatTooltipHeaderMarkdown instead
 * @param {Object} params
 * @param {string} params.word The word being hovered
 * @param {number} params.lookupTimeMs The time it took to perform the lookup
 * @param {string} params.source The source of the data (e.g., "lookup-database.json")
 * @returns {string[]}
 */
export function tooltipTitle({ word, lookupTimeMs, source }) {
	const line1 = `**🔍 Database Lookup for \`${word}\`** (${lookupTimeMs}ms)\n\n`;
	const line2 = `Source: \`${source}\`\n\n`;

	return [line1, line2];
}
