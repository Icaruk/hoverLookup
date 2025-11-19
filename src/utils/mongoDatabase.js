import { MongoClient } from "mongodb";
import * as vscode from "vscode";

let mongoClient = null;

/**
 * Get MongoDB configuration from VSCode settings
 * @returns {{url: string, databases: Array, collections: Array}}
 */
function getMongoConfig() {
	const config = vscode.workspace.getConfiguration("hoverLookup");
	const url = (config.get("mongodbUrl") || "").trim();
	const databases = config.get("mongodbDatabases") || [];
	const collections = config.get("mongodbCollections") || [];

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

		if (mongoClient) {
			return mongoClient;
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
 * Search for a value in MongoDB collections
 * @param {string} searchValue - The value to search for
 * @returns {Promise<{document: Object, source: string} | null>} - The document and source if found, null otherwise
 */
async function searchMongoDatabase(searchValue) {
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
		const databasesToSearch = databases && databases.length > 0 ? databases : [null];

		// Search in each database in order
		for (const dbName of databasesToSearch) {
			const db = dbName ? client.db(dbName) : client.db();

			for (const collectionConfig of collections) {
				const { collection: collectionName, searchFields, project } = collectionConfig;

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

export { getMongoConfig, connectMongo, disconnectMongo, loadMongoDatabase, searchMongoDatabase };
