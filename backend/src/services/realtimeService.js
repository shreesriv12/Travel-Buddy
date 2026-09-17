import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let io;

export function initializeRealtime(server) {
  io = new Server(server, {
    cors: { origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"], credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error("Invalid socket token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user.userId}`);
  });
  console.log("Socket.IO real-time alerts enabled");
  return io;
}

export function emitAlert(userId, notification) {
  io?.to(`user:${userId}`).emit("trip:alert", notification);
}

export function closeRealtime() {
  io?.close();
}
