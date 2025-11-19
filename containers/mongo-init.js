// @ts-nocheck

// MongoDB init script
// This is executed automatically when the container is created for the first time
// This is not .js file is executed in mongosh

db = db.getSiblingDB("hoverlookup");

db.createCollection("users");
db.createCollection("orders");

db.users.createIndex({ id: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });

db.users.insertMany([
	{
		id: "62acb797-eb6c-43d6-bc4c-b4ffa8f98db0",
		username: "user_1",
		email: "user_1@example.com",
	},
	{
		id: "5b91119a-4964-4204-bbe0-20f9a3c9f1df",
		username: "user_2",
		email: "user_2@example.com",
	},
	{
		id: "d414a108-bffe-4ad9-85bd-7a3efa54f883",
		username: "user_3",
		email: "user_3@example.com",
	},
	{
		id: "068e697e-0fc4-4197-a5bf-25857b2da705",
		username: "user_4",
		email: "user_4@example.com",
	},
]);

db.orders.createIndex({ id: 1 }, { unique: true });

db.orders.insertMany([
	{
		id: "ORD-425-179",
		user_id: "62acb797-eb6c-43d6-bc4c-b4ffa8f98db0",
		amount: 1,
		status: "paid",
	},
	{
		id: "ORD-425-180",
		user_id: "5b91119a-4964-4204-bbe0-20f9a3c9f1df",
		amount: 3,
		status: "pending",
	},
]);

print("✅ DB initialized");
