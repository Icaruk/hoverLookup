/**
 * Configuration keys for HoverLookup extension
 * Centralized constants to avoid typos and make refactoring easier
 */

/**
 * Base configuration namespace
 */
export const CONFIG_NAMESPACE = "hoverLookup";

/**
 * Configuration property names (without namespace prefix)
 * Used with vscode.workspace.getConfiguration(CONFIG_NAMESPACE).get(...)
 */
export const CONFIG_PROPS = {
	ENABLE_JSON_DATABASE: "enableJsonDatabase",
	ENABLE_MONGODB: "enableMongoDB",
	DATABASE_PATHS: "databasePaths",
	MONGODB_URL: "mongodbUrl",
	MONGODB_DATABASES: "mongodbDatabases",
	MONGODB_COLLECTIONS: "mongodbCollections",
	MONGODB_MAX_CACHE_SIZE: "mongodbMaxCacheSize",
	MONGODB_CACHE_TTL_MINUTES: "mongodbCacheTtlMinutes",
	MAX_HOVER_SIZE: "maxHoverSize",
};

/**
 * Configuration keys for HoverLookup settings
 */
export const CONFIG_KEYS = {
	ENABLE_JSON_DATABASE: `${CONFIG_NAMESPACE}.${CONFIG_PROPS.ENABLE_JSON_DATABASE}`,
	ENABLE_MONGODB: `${CONFIG_NAMESPACE}.${CONFIG_PROPS.ENABLE_MONGODB}`,
	DATABASE_PATHS: `${CONFIG_NAMESPACE}.${CONFIG_PROPS.DATABASE_PATHS}`,
	MONGODB_URL: `${CONFIG_NAMESPACE}.${CONFIG_PROPS.MONGODB_URL}`,
	MONGODB_DATABASES: `${CONFIG_NAMESPACE}.${CONFIG_PROPS.MONGODB_DATABASES}`,
	MONGODB_COLLECTIONS: `${CONFIG_NAMESPACE}.${CONFIG_PROPS.MONGODB_COLLECTIONS}`,
	MONGODB_MAX_CACHE_SIZE: `${CONFIG_NAMESPACE}.${CONFIG_PROPS.MONGODB_MAX_CACHE_SIZE}`,
	MONGODB_CACHE_TTL_MINUTES: `${CONFIG_NAMESPACE}.${CONFIG_PROPS.MONGODB_CACHE_TTL_MINUTES}`,
	MAX_HOVER_SIZE: `${CONFIG_NAMESPACE}.${CONFIG_PROPS.MAX_HOVER_SIZE}`,
};

/**
 * Global state keys
 */
export const STATE_KEYS = {
	HIDE_COLLECTIONS_WARNING: `${CONFIG_NAMESPACE}.hideCollectionsWarning`,
};

/**
 * Command IDs
 */
export const COMMAND_IDS = {
	RELOAD_DATABASE: `${CONFIG_NAMESPACE}.reloadDatabase`,
	INIT_DATABASE: `${CONFIG_NAMESPACE}.initDatabase`,
	RECONNECT_MONGODB: `${CONFIG_NAMESPACE}.reconnectMongoDB`,
	TOGGLE_JSON_DATABASE: `${CONFIG_NAMESPACE}.toggleLookupJsonDatabase`,
	TOGGLE_MONGODB: `${CONFIG_NAMESPACE}.toggleLookupMongoDB`,
	OPEN_SETTINGS: `${CONFIG_NAMESPACE}.openSettings`,
	CLEAR_MONGO_CACHE: `${CONFIG_NAMESPACE}.clearMongoCache`,
};

export const WINDOW_MESSAGES = {
	DONT_SHOW_AGAIN: "Don't show again",
	OPEN_SETTINGS: "Open Settings",
};
