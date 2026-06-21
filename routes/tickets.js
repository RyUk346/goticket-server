const router = require("express").Router();
const { ObjectId } = require("mongodb");
const { collections } = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");

const vendorOnly = requireRole("vendor");

router.get("/api/tickets", async (req, res) => {
  const { tickets } = collections();
  const { search, transportType, sort, page = 1, limit = 9 } = req.query;

  const query = { status: "approved", isFraudHidden: { $ne: true } };
  if (search && search !== "undefined") {
    query.$or = [
      { from: { $regex: search, $options: "i" } },
      { to: { $regex: search, $options: "i" } },
      { title: { $regex: search, $options: "i" } },
    ];
  }
  if (transportType && transportType !== "all" && transportType !== "undefined") {
    query.transportType = transportType;
  }

  let sortStage = { createdAt: -1 };
  if (sort === "price_asc") sortStage = { price: 1 };
  if (sort === "price_desc") sortStage = { price: -1 };

  const pageNum = Math.max(1, Number(page));
  const lim = Math.max(1, Number(limit));
  const skip = (pageNum - 1) * lim;

  const total = await tickets.countDocuments(query);
  const data = await tickets.find(query).sort(sortStage).skip(skip).limit(lim).toArray();
  res.send({ data, total, page: pageNum, totalPage: Math.ceil(total / lim) });
});

router.get("/api/tickets/advertised", async (req, res) => {
  const { tickets } = collections();
  const data = await tickets
    .find({ status: "approved", isAdvertised: true, isFraudHidden: { $ne: true } })
    .sort({ createdAt: -1 }).limit(6).toArray();
  res.send(data);
});

router.get("/api/tickets/latest", async (req, res) => {
  const { tickets } = collections();
  const data = await tickets
    .find({ status: "approved", isFraudHidden: { $ne: true } })
    .sort({ createdAt: -1 }).limit(8).toArray();
  res.send(data);
});

router.post("/api/tickets", verifyToken, vendorOnly, async (req, res) => {
  const { tickets } = collections();
  if (req.dbUser.fraud) {
    return res.status(403).send({ message: "Account flagged. You cannot add tickets." });
  }
  const b = req.body;
  const doc = {
    title: b.title,
    from: b.from,
    to: b.to,
    transportType: b.transportType,
    price: Number(b.price),
    quantity: Number(b.quantity),
    departureDate: b.departureDate,
    perks: Array.isArray(b.perks) ? b.perks : [],
    image: b.image,
    description: b.description || "",
    vendorName: req.dbUser.name || b.vendorName,
    vendorEmail: req.user.email,
    status: "pending",
    isAdvertised: false,
    isFraudHidden: false,
    createdAt: new Date(),
  };
  const result = await tickets.insertOne(doc);
  res.send(result);
});

router.get("/api/tickets/vendor/:email", verifyToken, vendorOnly, async (req, res) => {
  if (req.params.email !== req.user.email) return res.status(403).send({ message: "Forbidden" });
  const { tickets } = collections();
  const data = await tickets.find({ vendorEmail: req.params.email }).sort({ createdAt: -1 }).toArray();
  res.send(data);
});

router.patch("/api/tickets/:id", verifyToken, vendorOnly, async (req, res) => {
  const { tickets } = collections();
  const ticket = await tickets.findOne({ _id: new ObjectId(req.params.id) });
  if (!ticket) return res.status(404).send({ message: "Ticket not found" });
  if (ticket.vendorEmail !== req.user.email) return res.status(403).send({ message: "Not your ticket" });
  if (ticket.status === "rejected") return res.status(400).send({ message: "Rejected tickets cannot be edited" });
  const b = req.body;
  const update = {
    title: b.title,
    from: b.from,
    to: b.to,
    transportType: b.transportType,
    price: Number(b.price),
    quantity: Number(b.quantity),
    departureDate: b.departureDate,
    perks: Array.isArray(b.perks) ? b.perks : ticket.perks,
    image: b.image || ticket.image,
    description: b.description ?? ticket.description,
    status: "pending",
    isAdvertised: false,
  };
  const result = await tickets.updateOne({ _id: ticket._id }, { $set: update });
  res.send(result);
});

router.delete("/api/tickets/:id", verifyToken, vendorOnly, async (req, res) => {
  const { tickets } = collections();
  const ticket = await tickets.findOne({ _id: new ObjectId(req.params.id) });
  if (!ticket) return res.status(404).send({ message: "Ticket not found" });
  if (ticket.vendorEmail !== req.user.email) return res.status(403).send({ message: "Not your ticket" });
  if (ticket.status === "rejected") return res.status(400).send({ message: "Rejected tickets cannot be deleted" });
  const result = await tickets.deleteOne({ _id: ticket._id });
  res.send(result);
});

router.get("/api/tickets/:id", async (req, res) => {
  try {
    const { tickets } = collections();
    const ticket = await tickets.findOne({ _id: new ObjectId(req.params.id) });
    if (!ticket) return res.status(404).send({ message: "Ticket not found" });
    res.send(ticket);
  } catch {
    res.status(400).send({ message: "Invalid ticket id" });
  }
});

module.exports = router;