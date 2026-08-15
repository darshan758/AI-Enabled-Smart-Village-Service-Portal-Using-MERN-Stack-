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