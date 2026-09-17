import prisma from "../config/db.js";

export async function submitFeedback(req, res, next) {
  try {
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: "rating must be an integer from 1 to 5" });
    const trip = await prisma.trip.findFirst({ where: { id: req.params.id, user_id: req.user.userId } });
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    const feedback = await prisma.userFeedback.create({ data: { user_id: req.user.userId, trip_id: trip.id, rating, liked_tags: Array.isArray(req.body.likedTags) ? req.body.likedTags : [], notes: req.body.notes || null } });
    res.status(201).json({ feedback });
  } catch (error) { next(error); }
}
