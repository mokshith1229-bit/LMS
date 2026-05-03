const express = require('express');
const router = express.Router();
const BatchAssignment = require('../models/BatchAssignment');
const Quiz = require('../models/Quiz');
const Batch = require('../models/Batch');
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/role');

// Admin only routes
router.use(protect, checkRole('admin'));

// @route   POST /api/assignment/create
// @desc    Assign a quiz to a batch with a schedule
// @access  Admin
router.post('/create', async (req, res) => {
  try {
    const { batchId, quizId, startTime, endTime } = req.body;

    if (!batchId || !quizId || !startTime || !endTime) {
      return res.status(400).json({ 
        success: false, 
        message: 'batchId, quizId, startTime, and endTime are required' 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(batchId) || !mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({ success: false, message: 'Invalid batchId or quizId' });
    }

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (new Date(startTime) >= new Date(endTime)) {
      return res.status(400).json({ success: false, message: 'startTime must be before endTime' });
    }

    // Upsert the batch assignment (allow updating schedule if already assigned)
    const assignment = await BatchAssignment.findOneAndUpdate(
      { batchId, quizId },
      {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        isActive: true,
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      assignment,
      message: `Quiz assigned to batch "${batch.name}" successfully`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/assignment/batch
// @desc    Get all batch assignments
// @access  Admin
router.get('/batch', async (req, res) => {
  try {
    const assignments = await BatchAssignment.find()
      .populate('batchId', 'name')
      .populate('quizId', 'title')
      .sort({ createdAt: -1 });

    res.json({ success: true, assignments, count: assignments.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
