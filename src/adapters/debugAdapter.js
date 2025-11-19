const { getDatabase } = require("../utils/database");

/**
 * Debug adapter tracker to intercept and enrich debugger hover responses
 * Adds database lookup information to the debugger's evaluate responses
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

				const database = getDatabase();

				// Measure lookup time
				const lookupStart = performance.now();
				const dbResult = database[String(lookupValue)];
				const lookupTime = performance.now() - lookupStart;

				if (dbResult) {
					console.log(
						`[HoverLookup] Debug lookup for "${lookupValue}": ${lookupTime.toFixed(3)}ms`,
					);

					const dbInfo = JSON.stringify(dbResult, null, 2);
					const enrichedResult = `${result}\n\n🔍 Lookup Database (${lookupTime.toFixed(3)}ms):\n${dbInfo}`;
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

module.exports = {
	LookupDebugAdapterTracker,
	LookupDebugAdapterTrackerFactory,
};
