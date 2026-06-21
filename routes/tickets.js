const router = require("express").Router();
const { ObjectId } = require("mongodb");
const { collections } = require("../config/db");

// All approved tickets — search (from/to/title), filter (transport), sort (price), paginate
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

// Advertised tickets for the homepage (max 6)
router.get("/api/tickets/advertised", async (req, res) => {
  const { tickets } = collections();
  const data = await tickets
    .find({ status: "approved", isAdvertised: true, isFraudHidden: { $ne: true } })
    .sort({ createdAt: -1 }).limit(6).toArray();
  res.send(data);
});

// Latest approved tickets for the homepage
router.get("/api/tickets/latest", async (req, res) => {
  const { tickets } = collections();
  const data = await tickets
    .find({ status: "approved", isFraudHidden: { $ne: true } })
    .sort({ createdAt: -1 }).limit(8).toArray();
  res.send(data);
});

// Single ticket (public) — keep LAST so it doesn't shadow /advertised and /latest
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