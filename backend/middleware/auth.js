const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // --- Demo User handling ---
    if (String(decoded.id).startsWith('demo_') || String(decoded.id).startsWith('mock_')) {
      const is_admin = decoded.id.includes('admin');
      req.user = {
        _id: decoded.id,
        name: is_admin ? 'System Administrator' : 'Assessment Candidate',
        email: is_admin ? 'admin@test.com' : 'student@test.com',
        role: is_admin ? 'admin' : 'student',
      };
      return next();
    }
    // --------------------------


    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

module.exports = { protect };
