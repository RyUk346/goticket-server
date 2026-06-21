const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const { connectDB } = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

app.use(cors({ origin: [CLIENT_URL, "http://localhost:3000"], credentials: true }));
app.use(express.json());

// Health check (no DB needed)
app.get("/", (req, res) => {
  res.send({ service: "GoTicket API", status: "running" });
});

// Ensure a DB connection for every /api request (cached after the first call)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("DB connection error:", err.message);
    res.status(500).send({ message: "Database connection failed" });
  }
});

app.listen(PORT, () => console.log(`GoTicket server running on port ${PORT}`));