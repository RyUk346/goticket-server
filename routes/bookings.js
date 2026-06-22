const router = require("express").Router();
const { ObjectId } = require("mongodb");
const { collections } = require("../config/db");
const { verifyToken, requireRole, sameUserOrAdmin } = require("../middleware/auth");

const vendorOnly = requireRole("vendor");

router.post("/api/bookings", verifyToken, async (req, res) => {
  const { tickets, bookings } = collections();
  const { ticketId, quantity } = req.body;
  const qty = Number(quantity);
  if (!ticketId || !qty || qty < 1) return res.status(400).send({ message: "Invalid booking data" });

  const ticket = await tickets.findOne({ _id: new ObjectId(ticketId) });
  if (!ticket || ticket.status !== "approved" || ticket.isFraudHidden) {
    return res.status(404).send({ message: "Ticket not available" });
  }
  if (new Date(ticket.departureDate).getTime() <= Date.now()) {
    return res.status(400).send({ message: "Departure has already passed" });
  }
  if (qty > ticket.quantity) {
    return res.status(400).send({ message: "Quantity exceeds availability" });
  }

  const doc = {
    ticketId: ticket._id.toString(),
    ticketTitle: ticket.title,
    image: ticket.image,
    from: ticket.from,
    to: ticket.to,
    transportType: ticket.transportType,
    unitPrice: ticket.price,
    quantity: qty,
    totalPrice: ticket.price * qty,
    departureDate: ticket.departureDate,
    userName: req.user.name,
    userEmail: req.user.email,
    vendorEmail: ticket.vendorEmail,
    status: "pending",
    transactionId: null,
    createdAt: new Date(),
  };
  const result = await bookings.insertOne(doc);
  res.send({ ...result, booking: doc });
});

router.get("/api/bookings/user/:email", verifyToken, sameUserOrAdmin(), async (req, res) => {
  const { bookings } = collections();
  const data = await bookings.find({ userEmail: req.params.email }).sort({ createdAt: -1 }).toArray();
  res.send(data);
});

router.get("/api/bookings/vendor/:email", verifyToken, vendorOnly, async (req, res) => {
  if (req.params.email !== req.user.email) return res.status(403).send({ message: "Forbidden" });
  const { bookings } = collections();
  const data = await bookings.find({ vendorEmail: req.params.email }).sort({ createdAt: -1 }).toArray();
  res.send(data);
});

router.patch("/api/bookings/accept/:id", verifyToken, vendorOnly, async (req, res) => {
  const { bookings } = collections();
  const booking = await bookings.findOne({ _id: new ObjectId(req.params.id) });
  if (!booking) return res.status(404).send({ message: "Booking not found" });
  if (booking.vendorEmail !== req.user.email) return res.status(403).send({ message: "Forbidden" });
  const result = await bookings.updateOne({ _id: booking._id }, { $set: { status: "accepted" } });
  res.send(result);
});

router.patch("/api/bookings/reject/:id", verifyToken, vendorOnly, async (req, res) => {
  const { bookings } = collections();
  const booking = await bookings.findOne({ _id: new ObjectId(req.params.id) });
  if (!booking) return res.status(404).send({ message: "Booking not found" });
  if (booking.vendorEmail !== req.user.email) return res.status(403).send({ message: "Forbidden" });
  const result = await bookings.updateOne({ _id: booking._id }, { $set: { status: "rejected" } });
  res.send(result);
});

router.delete("/api/bookings/:id", verifyToken, async (req, res) => {
  const { bookings } = collections();
  const booking = await bookings.findOne({ _id: new ObjectId(req.params.id) });
  if (!booking) return res.status(404).send({ message: "Booking not found" });
  if (booking.userEmail !== req.user.email) return res.status(403).send({ message: "Forbidden" });
  if (booking.status !== "pending") return res.status(400).send({ message: "Only pending bookings can be cancelled" });
  const result = await bookings.deleteOne({ _id: booking._id });
  res.send(result);
});

module.exports = router;