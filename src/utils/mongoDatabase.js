import { MongoClient } from "mongodb";
import * as vscode from "vscode";
import { CONFIG_NAMESPACE, CONFIG_PROPS } from "../constants/config.js";

let mongoClient = null;

/**
 * In-memory cache for MongoDB results
 * Used for synchronous lookups during debug hover
 * @type {Map<string, {document: any, source: string, timestamp: number}>}
 */
const mongoCache = new Map();

/**
 * Get maximum cache size from configuration
 * @returns {number} - Maximum cache size (default: 1000)
 */
function getMaxCacheSize() {
	const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
	return config.get(CONFIG_PROPS.MONGODB_MAX_CACHE_SIZE) || 1000;
}

/**
 * Get cache TTL from configuration in milliseconds
 * @returns {number} - Cache TTL in milliseconds (default: 1 minute)
 */
function getCacheTTL() {
	const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
	const minutes = config.get(CONFIG_PROPS.MONGODB_CACHE_TTL_MINUTES) || 1;
	return minutes * 60 * 1000;
}

/**
 * Check if MongoDB is enabled
 * @returns {boolean}
 */
function isMongoDBEnabled() {
	const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
	return config.get(CONFIG_PROPS.ENABLE_MONGODB) !== false; // Default to true
}

/**
 * Get MongoDB configuration from VSCode settings
 * @returns {{url: string, databases: Array, collections: Array}}
 */
function getMongoConfig() {
	const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
	const url = (config.get(CONFIG_PROPS.MONGODB_URL) || "").trim();
	const databases = config.get(CONFIG_PROPS.MONGODB_DATABASES) || [];
	const collections = config.get(CONFIG_PROPS.MONGODB_COLLECTIONS) || [];

	return { url, databases, collections };
}

/**
 * Connect to MongoDB
 * @returns {Promise<MongoClient | null>}
 */
async function connectMongo() {
	try {
		const { url } = getMongoConfig();

		if (!url) {
			return null;
		}

		// Check if existing connection is still valid
		if (mongoClient) {
			try {
				// Ping to check if connection is alive
				await mongoClient.db().admin().ping();
				return mongoClient;
			} catch (_error) {
				// Connection is dead, close it and reconnect
				console.log("[HoverLookup] MongoDB connection lost, reconnecting...");
				try {
					await mongoClient.close();
				} catch (_closeError) {
					// Ignore close errors
				}
				mongoClient = null;
			}
		}

		mongoClient = new MongoClient(url);
		await mongoClient.connect();
		console.log("[HoverLookup] Connected to MongoDB");
		return mongoClient;
	} catch (error) {
		vscode.window.showErrorMessage(
			`HoverLookup: Failed to connect to MongoDB: ${error.message}`,
		);
		mongoClient = null;
		return null;
	}
}

/**
 * Disconnect from MongoDB
 */
async function disconnectMongo() {
	if (mongoClient) {
		await mongoClient.close();
		mongoClient = null;
		console.log("[HoverLookup] Disconnected from MongoDB");
	}
}

/**
 * Add a value to the MongoDB cache
 * @param {string} key - The search value
 * @param {any} document - The MongoDB document
 * @param {string} source - The source string (e.g., "MongoDB.database.collection")
 */
function addToMongoCache(key, document, source) {
	const maxCacheSize = getMaxCacheSize();

	// Check if cache is full
	if (mongoCache.size >= maxCacheSize) {
		// Remove oldest entry (first entry in Map)
		const firstKey = mongoCache.keys().next().value;
		mongoCache.delete(firstKey);
	}

	mongoCache.set(key, {
		document,
		source,
		timestamp: Date.now(),
	});
}

/**
 * Get a value from the MongoDB cache (synchronous)
 * @param {string} key - The search value
 * @returns {{document: any, source: string} | null}
 */
function getFromMongoCache(key) {
	const cached = mongoCache.get(key);

	if (!cached) {
		return null;
	}

	const cacheTTL = getCacheTTL();

	// Check if cache entry is expired
	const age = Date.now() - cached.timestamp;
	if (age > cacheTTL) {
		mongoCache.delete(key);
		return null;
	}

	return {
		document: cached.document,
		source: cached.source,
	};
}

/**
 * Clear the MongoDB cache
 */
function clearMongoCache() {
	mongoCache.clear();
	console.log("[HoverLookup] MongoDB cache cleared");
}

/**
 * Search for a value in MongoDB collections
 * @param {string} searchValue - The value to search for
 * @returns {Promise<{document: Object, source: string} | null>} - The document and source if found, null otherwise
 */
async function searchMongoDatabase(searchValue) {
	// Check if MongoDB is enabled
	if (!isMongoDBEnabled()) {
		return null;
	}

	const client = await connectMongo();
	if (!client) {
		return null;
	}

	try {
		const { databases, collections } = getMongoConfig();

		if (!collections || collections.length === 0) {
			return null;
		}

		// If no databases specified, use default database
		const databasesToSearch =
			databases && databases.length > 0 ? databases : [null];

		// Search in each database in order
		for (const dbName of databasesToSearch) {
			const db = dbName ? client.db(dbName) : client.db();

			for (const collectionConfig of collections) {
				const {
					collection: collectionName,
					searchFields,
					project,
				} = collectionConfig;

				if (
					!collectionName ||
					!Array.isArray(searchFields) ||
					searchFields.length === 0
				) {
					continue;
				}

				try {
					const collection = db.collection(collectionName);

					// Build query: search for the value in any of the searchFields
					const query = {
						$or: searchFields.map((field) => ({
							[field]: searchValue,
						})),
					};

					// Build options with projection if provided
					const options = {};
					if (project && typeof project === "object") {
						options.projection = project;
					}

					const document = await collection.findOne(query, options);

					if (document) {
						const dbDisplay = dbName ? `${dbName}` : "default";
						const source = `MongoDB.${dbDisplay}`;
						console.log(
							`[HoverLookup] Found document in MongoDB collection: ${dbDisplay}.${collectionName}`,
						);

						// Add to cache for future synchronous lookups
						addToMongoCache(searchValue, document, source);

						return { document, source };
					}
				} catch (error) {
					const dbDisplay = dbName ? `${dbName}.` : "";
					console.error(
						`[HoverLookup] Error searching collection ${dbDisplay}${collectionName}: ${error.message}`,
					);
				}
			}
		}

		return null;
	} catch (error) {
		console.error(
			`[HoverLookup] Error searching MongoDB database: ${error.message}`,
		);
		return null;
	}
}

/**
 * Load data from MongoDB collections (deprecated - kept for backward compatibility)
 * @returns {Promise<Object>}
 */
async function loadMongoDatabase() {
	// Return empty object - MongoDB is now queried on-demand
	return {};
}

export {
	getMongoConfig,
	connectMongo,
	disconnectMongo,
	loadMongoDatabase,
	searchMongoDatabase,
	isMongoDBEnabled,
	getFromMongoCache,
	clearMongoCache,
};
