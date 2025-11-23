import {
	getDatabase,
	getDatabaseSource,
	isJsonDatabaseEnabled,
} from "../utils/database.js";
import {
	getFromMongoCache,
	searchMongoDatabase,
} from "../utils/mongoDatabase.js";
import { formatTooltipHeaderPlainText } from "../utils/tooltip.js";
import {
	extractObjectValues,
	tryParseObject,
} from "../utils/variableResolver.js";

/**
 * Search for a value synchronously in databases and cache
 * @param {string|number} searchValue - The value to search for
 * @returns {{result: any, source: string, lookupTime: number} | null}
 */
function searchSynchronously(searchValue) {
	let result = null;
	let source = null;
	let lookupTime = 0;

	// Try JSON database first (synchronous)
	if (isJsonDatabaseEnabled()) {
		const database = getDatabase();
		const lookupStart = performance.now();
		result = database[String(searchValue)];
		source = getDatabaseSource(String(searchValue));
		lookupTime = performance.now() - lookupStart;
	}

	// If not found in JSON database, try MongoDB cache (synchronous)
	if (!result) {
		const cacheStart = performance.now();
		const cachedResult = getFromMongoCache(String(searchValue));
		lookupTime += performance.now() - cacheStart;

		if (cachedResult) {
			result = cachedResult.document;
			source = `${cachedResult.source} (cached)`;
		}
	}

	if (result) {
		return { result, source, lookupTime };
	}

	return null;
}

/**
 * Search with multiple values synchronously
 * @param {Array<string|number>} values - Array of values to search
 * @returns {{result: any, source: string, lookupTime: number, matchedValue: string|number} | null}
 */
function searchWithMultipleValuesSync(values) {
	for (const value of values) {
		const searchResult = searchSynchronously(value);
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
 * Debug adapter tracker to intercept and enrich debugger hover responses
 * Adds database lookup information to the debugger's evaluate responses
 *
 * IMPORTANT: This method MUST be synchronous (not async) for the tooltip to work.
 * VSCode processes the message immediately after onDidSendMessage returns.
 * If the method is async, the tooltip will be shown before the message is modified.
 *
 * Therefore, we search in:
 * 1. JSON database (synchronous)
 * 2. MongoDB cache (synchronous) - values that were previously searched
 * 3. If not found in cache, trigger async MongoDB search in background (for next hover)
 * 4. For objects, try all values sequentially until a match is found
 */
class LookupDebugAdapterTracker {
	constructor(session) {
		this.session = session;
	}

	onDidSendMessage(message) {
		if (
			message.type === "response" &&
			message.command === "evaluate" &&
			message.success
		) {
			const body = message.body;
			if (!body) return;

			const result = body.result;

			if (result === undefined) {
				return;
			}

			console.log(
				`[HoverLookup] Debug adapter received: result="${result}", variablesReference=${body.variablesReference}`,
			);

			let lookupValue = result;
			let matchedValue = null;
			let dbResult = null;
			let source = null;
			let lookupTime = 0;

			// Try to parse as object first
			const parsedObject = tryParseObject(result);

			if (parsedObject) {
				// It's an object - extract all values and search with each one
				const objectValues = extractObjectValues(parsedObject);

				if (objectValues.length > 0) {
					console.log(
						`[HoverLookup] Debug adapter: Object detected with ${objectValues.length} searchable values`,
					);

					const multiSearch = searchWithMultipleValuesSync(objectValues);

					if (multiSearch) {
						dbResult = multiSearch.result;
						source = multiSearch.source;
						lookupTime = multiSearch.lookupTime;
						matchedValue = multiSearch.matchedValue;

						console.log(
							`[HoverLookup] Debug adapter: Found match using object value: ${matchedValue}`,
						);
					} else {
						// Not found in cache - trigger background search for all values
						for (const value of objectValues) {
							searchMongoDatabase(String(value)).catch((error) => {
								console.error(
									`[HoverLookup] Background MongoDB search failed for value ${value}: ${error.message}`,
								);
							});
						}
					}
				}
			} else {
				// It's a primitive value
				if (typeof lookupValue === "string") {
					const stringMatch = lookupValue.match(/^['"](.*)['"]$/);
					if (stringMatch) {
						lookupValue = stringMatch[1];
					}
				}

				const searchResult = searchSynchronously(lookupValue);

				if (searchResult) {
					dbResult = searchResult.result;
					source = searchResult.source;
					lookupTime = searchResult.lookupTime;
					matchedValue = lookupValue;
				} else {
					// Not in cache - start async search in background for next time
					searchMongoDatabase(String(lookupValue)).catch((error) => {
						console.error(
							`[HoverLookup] Background MongoDB search failed: ${error.message}`,
						);
					});
				}
			}

			if (dbResult) {
				console.log(
					`[HoverLookup] Debug lookup for "${lookupValue}": ${lookupTime.toFixed(3)}ms (from ${source})`,
				);

				const _lookupTime = +lookupTime.toFixed(3);

				const dbInfo = JSON.stringify(dbResult, null, 2);

				// Format the enriched result with simple text formatting
				// Debug hover doesn't support markdown, so we use plain text
				// Only pass matchedValue if it's different from lookupValue (i.e., it's from an object)
				const headerMatchedValue =
					matchedValue !== null && String(matchedValue) !== String(lookupValue)
						? matchedValue
						: undefined;

				const header = formatTooltipHeaderPlainText({
					lookupTimeMs: _lookupTime,
					source,
					matchedValue: headerMatchedValue,
				});

				const enrichedResult = `${result}${header}${dbInfo}`;

				// Modify the message body
				message.body.result = enrichedResult;

				// Force variablesReference to 0 to show our enriched text tooltip
				// instead of the expandable object tooltip
				message.body.variablesReference = 0;
			}
		}
	}
}

/**
 * Factory for creating debug adapter trackers
 */
class LookupDebugAdapterTrackerFactory {
	createDebugAdapterTracker(session) {
		return new LookupDebugAdapterTracker(session);
	}
}

export { LookupDebugAdapterTracker, LookupDebugAdapterTrackerFactory };
