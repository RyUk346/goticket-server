const dns = require("node:dns");
// Helps MongoDB Atlas SRV records resolve on networks/hosts whose default
// resolver blocks SRV lookups. Harmless for a local mongodb:// URI.
try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
  dns.setDefaultResultOrder("ipv4first");
} catch {}

const { MongoClient, ServerApiVersion } = require("mongodb");

let client;
let db;

async function connectDB() {
  if (db) return db;
  client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  });
  await client.connect();
  db = client.db("goticketDb");
  console.log("GoTicket: connected to MongoDB");
  return db;
}

function getDB() {
  if (!db) throw new Error("Database not initialized — call connectDB() first");
  return db;
}

// Convenience accessor for every collection we use.
function collections() {
  const d = getDB();
  return {
    users: d.collection("user"), // managed by BetterAuth from the client
    tickets: d.collection("tickets"),
    bookings: d.collection("bookings"),
    payments: d.collection("payments"),
  };
}

module.exports = { connectDB, getDB, collections };