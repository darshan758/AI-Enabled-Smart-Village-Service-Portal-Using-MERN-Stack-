let io;

exports.init = (server) => {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── Verified, role-based rooms for the live map ────────────────────────
    // The client sends its JWT in the handshake (auth.token). The server — not
    // the client — decides which private rooms the socket may join:
    //   superadmin / admin without a district -> admins_all
    //   admin with a district                  -> admins_<district>
    //   department                             -> dept_<userId>
    // Sockets without a valid token still connect (legacy user notifications)
    // but never join any of these rooms.
    (async () => {
      try {
        const token = socket.handshake.auth && socket.handshake.auth.token;
        if (!token) return;
        const jwt = require('jsonwebtoken');
        const User = require('../models/User');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const u = await User.findById(decoded.id).select('role district isActive');
        if (!u || u.isActive === false) return;
        if (u.role === 'superadmin' || (u.role === 'admin' && !u.district)) socket.join('admins_all');
        else if (u.role === 'admin') socket.join(`admins_${u.district}`);
        else if (u.role === 'department') socket.join(`dept_${u._id}`);
      } catch (e) {
        // invalid / expired token: no private rooms
      }
    })();

    // Admin room
    socket.on('join_admin', () => {
      socket.join('admins');
      console.log('Admin joined socket room');
    });

    // User room (both event names for compatibility)
    socket.on('join_user', (userId) => {
      socket.join(`user_${userId}`);
      console.log(`User joined socket room: ${userId}`);
    });
    socket.on('join', (userId) => {
      socket.join(`user_${userId}`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

exports.getIO = () => {
  if (!io) throw new Error('Socket not initialized');
  return io;
};