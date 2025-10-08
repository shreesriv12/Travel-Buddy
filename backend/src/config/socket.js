// src/config/socket.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io;

export function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:3000",
      credentials: true,
      methods: ["GET", "POST"]
    },
    // Allow both polling and websocket
    transports: ['polling', 'websocket'],
    // Increase timeouts
    pingTimeout: 60000,
    pingInterval: 25000
  });

  console.log('[Socket] Initializing Socket.IO server...');

  // Authentication middleware
  io.use((socket, next) => {
    console.log('[Socket] Authentication attempt from:', socket.id);
    
    // Try to get token from auth object first
    let token = socket.handshake.auth?.token;
    
    // Fallback to query params
    if (!token) {
      token = socket.handshake.query?.token;
    }
    
    // Fallback to headers
    if (!token) {
      const authHeader = socket.handshake.headers?.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      console.error('[Socket] No token provided');
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('[Socket] Token verified for user:', decoded.userId);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      console.error('[Socket] Token verification failed:', err.message);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] ✓ User ${socket.userId} connected (${socket.id})`);
    
    // Join user-specific room
    const userRoom = `user:${socket.userId}`;
    socket.join(userRoom);
    console.log(`[Socket] User joined room: ${userRoom}`);
    
    // Send connection confirmation
    socket.emit('connected', { 
      message: 'Connected to real-time updates',
      userId: socket.userId 
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User ${socket.userId} disconnected: ${reason}`);
    });

    socket.on('error', (error) => {
      console.error(`[Socket] Error for user ${socket.userId}:`, error);
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  // Global error handler
  io.engine.on('connection_error', (err) => {
    console.error('[Socket] Connection error:', err);
  });

  console.log('[Socket] ✓ Socket.IO initialized successfully');
  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return io;
}