require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

// Connect to MongoDB
connectDB();

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Attach io to app so routes can access it
app.set('io', io);

io.on('connection', (socket) => {
  console.log('A user connected via socket:', socket.id);

  socket.on('join_poll', (code) => {
    socket.join(code);
    console.log(`Socket ${socket.id} joined poll room ${code}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Middleware
app.use(cors({
  origin: "*"
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger for Debugging
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.url}`);
  next();
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/content', require('./routes/content'));
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/submit', require('./routes/submit'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/poll', require('./routes/poll'));
app.use('/api/presentation', require('./routes/presentation'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'LMS API is running 🚀', timestamp: new Date() });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  }
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 LMS Server running on http://localhost:${PORT}`);
});
 
