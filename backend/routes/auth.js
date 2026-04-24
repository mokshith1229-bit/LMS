const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, mobile, password, role } = req.body;

    if (!name || (!email && !mobile) || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email/mobile, and password' });
    }

    const query = [];
    if (email) query.push({ email });
    if (mobile) query.push({ mobile });

    const existingUser = await User.findOne({ $or: query });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email or Mobile already registered' });
    }

    const user = await User.create({ name, email, mobile, password, role: role || 'student' });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body; // email field here acts as a general identifier (email or mobile)

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide credentials' });
    }

    // --- Development Mock Login (Bypass DB if needed) ---
    if (password === 'password') {
      if (email === 'admin@test.com') {
        const mockUser = { _id: 'demo_admin_123', name: 'Admin', email: 'admin@test.com', role: 'admin' };
        return res.json({ success: true, token: generateToken(mockUser._id), user: mockUser });
      }
    }
    // ----------------------------------------------------

    const user = await User.findOne({
      $or: [{ email: email.toLowerCase().trim() }, { mobile: email.trim() }]
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/auth/me
// @access  Private
const { protect } = require('../middleware/auth');
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
