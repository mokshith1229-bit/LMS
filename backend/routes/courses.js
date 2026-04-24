const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const Module = require('../models/Module');
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/role');
const demoStore = require('./demoStore');

// @route   POST /api/courses
// @access  Admin only
router.post('/', protect, checkRole('admin'), async (req, res) => {
  try {
    const { title, description, thumbnail } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description required' });
    }

    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      const newCourse = {
        _id: 'demo_course_' + Date.now(),
        title,
        description,
        thumbnail: thumbnail || '',
        createdBy: { name: req.user.name || 'System Administrator', email: req.user.email },
        createdAt: new Date(),
        isPublished: true,
        modules: [],
        enrolledStudents: []
      };
      
      demoStore.courses.push(newCourse);

      return res.status(201).json({
        success: true,
        message: 'Course created successfully (Simulation Mode)',
        course: newCourse,
      });
    }

    const course = await Course.create({
      title,
      description,
      thumbnail: thumbnail || '',
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// @route   GET /api/courses
// @access  Private (all roles)
router.get('/', protect, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, courses: demoStore.courses });
    }

    const courses = await Course.find({ isPublished: true })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, courses: [...demoStore.courses, ...courses] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/courses/admin/stats
// @access  Private Admin
router.get('/admin/stats', protect, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        stats: {
          totalCourses: demoStore.courses.length,
          totalStudents: demoStore.courses.reduce((acc, c) => acc + c.enrolledStudents.length, 0),
          totalSubmissions: 0
        }
      });
    }

    const totalCourses = await Course.countDocuments();
    
    // Count total unique student users in the system
    const User = require('../models/User');
    const totalStudents = await User.countDocuments({ role: 'student' });
    
    const Submission = require('../models/Submission');
    const totalSubmissions = await Submission.countDocuments();

    res.json({
      success: true,
      stats: {
        totalCourses,
        totalStudents,
        totalSubmissions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/courses/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    // --- Simulation Handling ---
    if (mongoose.connection.readyState !== 1 || req.params.id.startsWith('demo') || req.params.id.startsWith('mock')) {
      const course = demoStore.courses.find(c => c._id === req.params.id);
      if (course) {
        // Temporary in-memory storage for Simulation Mode (Persistence while DB is offline)
        const hydratedModules = course.modules.map(modId => {
          const mod = demoStore.modules.find(m => m._id === modId);
          if (mod && mod.type === 'quiz') {
            const quiz = demoStore.quizzes.find(q => q._id === mod.quizId);
            return { ...mod, quizId: quiz };
          }
          return mod;
        }).filter(Boolean);

        return res.json({
          success: true,
          course: { ...course, modules: hydratedModules }
        });
      }
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ success: false, message: 'Database connection unavailable' });
      }
    }
    // ---------------------

    const course = await Course.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'modules',
        populate: { path: 'quizId', select: 'title timeLimitSeconds' },
      });

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    res.json({ success: true, course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/courses/:id
// @access  Admin only
router.delete('/:id', protect, checkRole('admin'), async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1 || req.params.id.startsWith('demo')) {
      const idx = demoStore.courses.findIndex(c => c._id === req.params.id);
      if (idx !== -1) {
        demoStore.courses.splice(idx, 1);
        return res.json({ success: true, message: 'Course deleted (Simulation Mode)' });
      }
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
