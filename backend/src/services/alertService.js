import prisma from "../config/db.js";
import { emitAlert } from "./realtimeService.js";

export async function createAlert({ userId, tripId = null, type = "trip_update", title, message }) {
  const notification = await prisma.notification.create({
    data: { user_id: userId, trip_id: tripId, type, title, message },
  });
  emitAlert(userId, notification);
  return notification;
}
