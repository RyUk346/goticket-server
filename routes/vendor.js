const router = require("express").Router();
const { collections } = require("../config/db");
const { verifyToken, requireRole } = require("../middleware/auth");

const vendorOnly = requireRole("vendor");

router.get("/api/vendor/revenue/:email", verifyToken, vendorOnly, async (req, res) => {
  if (req.params.email !== req.user.email) return res.status(403).send({ message: "Forbidden" });
  const { tickets, bookings } = collections();
  const email = req.params.email;

  const totalAdded = await tickets.countDocuments({ vendorEmail: email });
  const paidBookings = await bookings.find({ vendorEmail: email, status: "paid" }).toArray();
  const totalSold = paidBookings.reduce((s, b) => s + Number(b.quantity || 0), 0);
  const totalRevenue = paidBookings.reduce((s, b) => s + Number(b.totalPrice || 0), 0);

  const perTicketMap = {};
  for (const b of paidBookings) {
    if (!perTicketMap[b.ticketTitle]) perTicketMap[b.ticketTitle] = { name: b.ticketTitle, sold: 0, revenue: 0 };
    perTicketMap[b.ticketTitle].sold += Number(b.quantity || 0);
    perTicketMap[b.ticketTitle].revenue += Number(b.totalPrice || 0);
  }

  const statusAgg = await bookings.aggregate([
    { $match: { vendorEmail: email } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]).toArray();

  res.send({
    totalAdded,
    totalSold,
    totalRevenue,
    perTicket: Object.values(perTicketMap),
    byStatus: statusAgg.map((s) => ({ status: s._id, count: s.count })),
  });
});

module.exports = router;