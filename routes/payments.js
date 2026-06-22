const router = require("express").Router();
const { ObjectId } = require("mongodb");
const { collections } = require("../config/db");
const { verifyToken, sameUserOrAdmin } = require("../middleware/auth");

router.post("/api/payments", verifyToken, async (req, res) => {
  const { bookings, tickets, payments } = collections();
  const { bookingId, transactionId, amount } = req.body;
  if (!bookingId || !transactionId) return res.status(400).send({ message: "Missing payment data" });

  const existing = await payments.findOne({ transactionId });
  if (existing) return res.send({ message: "Already recorded", duplicate: true });

  const booking = await bookings.findOne({ _id: new ObjectId(bookingId) });
  if (!booking) return res.status(404).send({ message: "Booking not found" });
  if (booking.userEmail !== req.user.email) return res.status(403).send({ message: "Forbidden" });
  if (booking.status !== "accepted") return res.status(400).send({ message: "Booking is not in an accepted state" });
  if (new Date(booking.departureDate).getTime() <= Date.now()) {
    return res.status(400).send({ message: "Departure passed — payment not allowed" });
  }

  await bookings.updateOne({ _id: booking._id }, { $set: { status: "paid", transactionId } });
  await tickets.updateOne({ _id: new ObjectId(booking.ticketId) }, { $inc: { quantity: -Number(booking.quantity) } });

  const payment = {
    bookingId: booking._id.toString(),
    ticketId: booking.ticketId,
    ticketTitle: booking.ticketTitle,
    userEmail: booking.userEmail,
    amount: Number(amount ?? booking.totalPrice),
    transactionId,
    paymentDate: new Date(),
  };
  await payments.insertOne(payment);
  res.send({ message: "Payment recorded", payment });
});

router.get("/api/payments/user/:email", verifyToken, sameUserOrAdmin(), async (req, res) => {
  const { payments } = collections();
  const data = await payments.find({ userEmail: req.params.email }).sort({ paymentDate: -1 }).toArray();
  res.send(data);
});

module.exports = router;