// server.js — FINAL CORRECT VERSION

const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const server = http.createServer(app);

// ================= SOCKET.IO =================
// Initialize via socketHandler so getIO() works everywhere (e.g. complaintController)
const socketHandler = require('./socket/socketHandler');
const io = socketHandler.init(server);

// ================= MIDDLEWARE =================
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ================= ROUTES =================
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/complaints', require('./routes/complaintRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/superadmin', require('./routes/superAdminRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// ================= PUBLIC VILLAGE ROUTE =================
const Village = require('./models/Village');

app.get('/api/villages', async (req, res) => {
  try {
    const { state, district, taluk } = req.query;

    const filter = { isActive: true };

    if (state) filter.state = state;
    if (district) filter.district = district;
    if (taluk) filter.taluk = taluk;

    const villages = await Village.find(filter)
      .select('_id villageName state district taluk panchayat')
      .sort({ villageName: 1 });

    // Normalize field name so frontend always receives 'name'
    const normalized = villages.map((v) => ({
      _id: v._id,
      name: v.villageName,
      state: v.state,
      district: v.district,
      taluk: v.taluk,
      panchayat: v.panchayat,
    }));

    res.json({
      success: true,
      villages: normalized,
    });
  } catch (err) {
    console.error('Village fetch error:', err);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch villages',
    });
  }
});

// ================= HEALTH CHECK =================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    message: '🌾 Smart Village API Running',
    time: new Date().toISOString(),
  });
});

// ================= ERROR HANDLER =================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ================= DATABASE =================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');

    const PORT = process.env.PORT || 5000;

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Socket.IO ready`);

      // ── Auto-escalation background job ──────────────────────────────────
      // Runs once shortly after startup, then every hour. Isolated from all
      // request handling — errors inside it are caught and logged only.
      const runAutoEscalation = require('./utils/autoEscalate');
      setTimeout(runAutoEscalation, 30 * 1000);
      setInterval(runAutoEscalation, 60 * 60 * 1000);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
  });