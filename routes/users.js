const router = require("express").Router();
const { ObjectId } = require("mongodb");
const { collections } = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");

const adminOnly = requireRole("admin");

router.get("/api/users/:email", verifyToken, async (req, res) => {
  const { users } = collections();
  const user = await users.findOne({ email: req.params.email });
  res.send(user || {});
});

router.get("/api/users", verifyToken, adminOnly, async (req, res) => {
  const { users } = collections();
  const list = await users
    .find({})
    .project({ name: 1, email: 1, role: 1, image: 1, fraud: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .toArray();
  res.send(list);
});

router.patch("/api/users/role/:id", verifyToken, adminOnly, async (req, res) => {
  const { role } = req.body;
  if (!["admin", "vendor", "user"].includes(role)) return res.status(400).send({ message: "Invalid role" });
  const { users } = collections();
  const result = await users.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { role } });
  res.send(result);
});

router.patch("/api/users/fraud/:id", verifyToken, adminOnly, async (req, res) => {
  const { users, tickets } = collections();
  const target = await users.findOne({ _id: new ObjectId(req.params.id) });
  if (!target) return res.status(404).send({ message: "User not found" });
  if (target.role !== "vendor") return res.status(400).send({ message: "Only vendors can be marked fraud" });
  await users.updateOne({ _id: target._id }, { $set: { fraud: true } });
  await tickets.updateMany({ vendorEmail: target.email }, { $set: { isFraudHidden: true } });
  res.send({ message: "Vendor marked as fraud", email: target.email });
});

module.exports = router;