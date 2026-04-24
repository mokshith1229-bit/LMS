const express = require('express');
const router = express.Router();
const Assignment = require('../models/Assignment');
const Quiz = require('../models/Quiz');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// @route   GET /api/assignments/my
// @desc    Get all quizzes assigned to the logged-in student
// @access  Student
router.get('/my', async (req, res) => {
  try {
    const userId = req.user._id;

    const assignments = await Assignment.find({ userId })
      .populate('quizId', 'title duration passingScore')
      .sort({ assignedAt: -1 })
      .lean();

    const result = assignments.map((a) => ({
      assignmentId: a._id,
      quizId: a.quizId?._id,
      title: a.quizId?.title || 'Unknown Quiz',
      duration: a.quizId?.duration,
      passingScore: a.quizId?.passingScore,
      status: a.status,
      assignedAt: a.assignedAt,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
    }));

    res.json({ success: true, assignments: result, count: result.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
