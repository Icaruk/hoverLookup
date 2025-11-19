/**
 * @param {Object} params 
 * @param {string} params.word The word being hovered
 * @param {number} params.lookupTimeMs The time it took to perform the lookup
 * @param {string} params.source The source of the data (e.g., "lookup-database.json")
 * @returns {string[]}
 */
export function tooltipTitle({
	word,
	lookupTimeMs,
	source,
}) {
	const line1 = `**🔍 Database Lookup for \`${word}\`** (${lookupTimeMs}ms)\n\n`;
	const line2 = `Source: \`${source}\`\n\n`;
	
	return [line1, line2];
}