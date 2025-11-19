import {
	getDatabase,
	getDatabaseSource,
	isJsonDatabaseEnabled,
} from "../utils/database.js";
import { getFromMongoCache } from "../utils/mongoDatabase.js";
import { formatTooltipHeaderPlainText } from "../utils/tooltip.js";

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
 * 2. MongoDB cache (synchronous) - values that were previously searched in normal hover
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

			if (result !== undefined) {
				let lookupValue = result;

				if (typeof lookupValue === "string") {
					const stringMatch = lookupValue.match(/^['"](.*)['"]$/);
					if (stringMatch) {
						lookupValue = stringMatch[1];
					}
				}

				let dbResult = null;
				let source = null;
				let lookupTime = 0;

				// Try JSON database first (synchronous)
				if (isJsonDatabaseEnabled()) {
					const database = getDatabase();
					const lookupStart = performance.now();
					dbResult = database[String(lookupValue)];
					source = getDatabaseSource(String(lookupValue));
					lookupTime = performance.now() - lookupStart;
				}

				// If not found in JSON database, try MongoDB cache (synchronous)
				if (!dbResult) {
					const cacheStart = performance.now();
					const cachedResult = getFromMongoCache(String(lookupValue));
					lookupTime += performance.now() - cacheStart;

					if (cachedResult) {
						dbResult = cachedResult.document;
						source = `${cachedResult.source} (cached)`;
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
					const header = formatTooltipHeaderPlainText({
						lookupTimeMs: _lookupTime,
						source,
					});
					const enrichedResult = `${result}${header}${dbInfo}`;

					// Modify the message body
					message.body.result = enrichedResult;

					if (body.variablesReference === 0) {
						message.body.variablesReference = 0;
					}
				}
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
