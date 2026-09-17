import { Router } from "express";
import prisma from "../config/db.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", authenticate, async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({ where: { user_id: req.user.userId }, orderBy: { created_at: "desc" }, take: 50 });
    res.json({ notifications });
  } catch (error) { next(error); }
});

router.put("/:id/read", authenticate, async (req, res, next) => {
  try {
    const notification = await prisma.notification.updateMany({ where: { id: req.params.id, user_id: req.user.userId }, data: { is_read: true } });
    if (!notification.count) return res.status(404).json({ error: "Notification not found" });
    res.json({ success: true });
  } catch (error) { next(error); }
});

export default router;
