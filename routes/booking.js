const router = require("express").Router();
const { ObjectId } = require("mongodb");
const { collections } = require("../config/db");
const { verifyToken, sameUserOrAdmin } = require("../middleware/auth");

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

module.exports = router;