import { CONFIG_KEYS } from "../constants/config";

export const eventAffectsConfiguration = {
	/**
	 * @param {import("vscode").ConfigurationChangeEvent} event
	 * @returns {boolean}
	 */
	anyDatabase(event) {
		return (
			event.affectsConfiguration(CONFIG_KEYS.DATABASE_PATHS) ||
			event.affectsConfiguration(CONFIG_KEYS.MONGODB_URL) ||
			event.affectsConfiguration(CONFIG_KEYS.MONGODB_COLLECTIONS) ||
			event.affectsConfiguration(CONFIG_KEYS.MONGODB_DATABASES)
		);
	},

	/**
	 * @param {import("vscode").ConfigurationChangeEvent} event
	 * @returns {boolean}
	 */
	mongoDb(event) {
		return (
			event.affectsConfiguration(CONFIG_KEYS.MONGODB_URL) ||
			event.affectsConfiguration(CONFIG_KEYS.MONGODB_COLLECTIONS) ||
			event.affectsConfiguration(CONFIG_KEYS.MONGODB_DATABASES)
		);
	},

	/**
	 * @param {import("vscode").ConfigurationChangeEvent} event
	 * @returns {boolean}
	 */
	mongoDbPaths(event) {
		return event.affectsConfiguration(CONFIG_KEYS.DATABASE_PATHS);
	},

	/**
	 * @param {import("vscode").ConfigurationChangeEvent} event
	 * @returns {boolean}
	 */
	jsonDatabasePaths(event) {
		return event.affectsConfiguration(CONFIG_KEYS.DATABASE_PATHS);
	},
};
