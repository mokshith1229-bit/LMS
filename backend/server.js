require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

// Connect to MongoDB
console.log('[STARTUP] Connecting to MongoDB...');
connectDB();
console.log('[STARTUP] MongoDB connection initiated.');

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

  // Admin joins: join_poll is called with 'poll_admin_<code>'
  socket.on('join_poll', (code) => {
    socket.join(code);
    console.log(`Socket ${socket.id} joined poll room ${code}`);
  });

  // Student joins: join_poll_user is called with poll code only
  // Joins 'poll_users_<code>' room to receive poll_reveal events
  socket.on('join_poll_user', (code) => {
    socket.join(`poll_users_${code}`);
    console.log(`Socket ${socket.id} joined student room poll_users_${code}`);
  });

  // Presentation Sync logic
  socket.on('join_presentation', (presentationId) => {
    socket.join(`presentation_${presentationId}`);
    console.log(`Socket ${socket.id} joined presentation ${presentationId}`);
  });

  socket.on('slide_change', (data) => {
    // data contains { presentationId, slideIndex, questionIndex, mode, summaryPage }
    io.to(`presentation_${data.presentationId}`).emit('slide_changed', data);
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
console.log('[STARTUP] Registering routes...');
app.use('/api/auth', require('./routes/auth'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/content', require('./routes/content'));
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/submit', require('./routes/submit'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/assignment', require('./routes/batchAssignment'));
app.use('/api/batch', require('./routes/batch'));
app.use('/api/poll', require('./routes/poll'));
app.use('/api/presentation', require('./routes/presentation'));
app.use('/api/import', require('./routes/import'));
app.use('/api/categories', require('./routes/category'));

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
console.log(`[STARTUP] Attempting to start server on port ${PORT}...`);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 LMS Server running on http://0.0.0.0:${PORT}`);
});
 
