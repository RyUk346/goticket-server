const dns = require("node:dns");
try { dns.setServers(["8.8.8.8", "8.8.4.4"]); dns.setDefaultResultOrder("ipv4first"); } catch {}
require("dotenv").config();
const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set in .env");
  process.exit(1);
}

const email = process.argv[2];
const role = process.argv[3];
const ROLES = ["user", "vendor", "admin"];

if (!email || !role) {
  console.log("Usage: node set-role.js <email> <role>");
  console.log("Roles: user | vendor | admin");
  process.exit(1);
}

if (!ROLES.includes(role)) {
  console.error(`Invalid role "${role}". Use one of: ${ROLES.join(", ")}`);
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const users = client.db("goticketDb").collection("user");

  const found = await users.findOne({ email });
  if (!found) {
    console.error(`No user found with email: ${email}`);
    await client.close();
    process.exit(1);
  }

  await users.updateOne({ email }, { $set: { role } });
  console.log(`Updated ${email} -> role: ${role}`);
  await client.close();
}

main().catch((e) => { console.error("Failed:", e.message); process.exit(1); });