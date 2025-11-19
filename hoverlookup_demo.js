// This should fetch from lookup-database.json
const userId = 1;
const userId2 = 42;
const orderCode = "ORD-9876-001";

console.log(userId);
console.log(userId2);
console.log(orderCode);

// This should fetch MongoDB
const user1Id = "62acb797-eb6c-43d6-bc4c-b4ffa8f98db0";
const user1Username = "user_1";
const user1Email = "user_1@example.com";

const user2Id = "5b91119a-4964-4204-bbe0-20f9a3c9f1df";
const user2Username = "user_2";
const user2Email = "user_2@example.com";

console.log(user1Id);
console.log(user1Username);
console.log(user1Email);

console.log(user2Id);
console.log(user2Username);
console.log(user2Email);

const randomUserId = Math.random() > 0.5 ? user1Username : user2Username;
const user1UsernameComputed = `user_${2 - 1}`;

console.log(randomUserId);
console.log(user1UsernameComputed);

const tempUser = {
	id: "d414a108-bffe-4ad9-85bd-7a3efa54f883",
	username: "user_3",
	email: "user_3@example.com",
};

console.log(tempUser.id);
console.log(tempUser.username);
console.log(tempUser.email);

console.log("Put breakpoint here");
