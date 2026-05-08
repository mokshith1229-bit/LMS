const express = require('express');
const router = express.Router();
const BatchAssignment = require('../models/BatchAssignment');
const Quiz = require('../models/Quiz');
const Batch = require('../models/Batch');
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/role');

// Admin only routes - explicit middleware for clarity
const adminOnly = [protect, checkRole('admin')];

// @route   POST /api/assignment/create
// @desc    Assign a quiz to a batch with a schedule
// @access  Admin
router.post('/create', ...adminOnly, async (req, res) => {
  try {
    const { batchId, quizId, startTime, endTime } = req.body;
    console.log(`[BatchAssignment] Attempting to create/update: Batch=${batchId}, Quiz=${quizId}`);

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

    console.log(`[BatchAssignment] ✅ Success: ${assignment._id}`);
    res.status(201).json({
      success: true,
      assignment,
      message: `Quiz assigned to batch "${batch.name}" successfully`,
    });
  } catch (error) {
    console.error('[BatchAssignment] Create Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/assignment/batch
// @desc    Get all batch assignments
// @access  Admin
router.get('/batch', ...adminOnly, async (req, res) => {
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

// @route   DELETE /api/assignment/batch/:id
// @desc    Delete a batch assignment
// @access  Admin
router.delete('/batch/:id', ...adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid assignment ID' });
    }

    const deleted = await BatchAssignment.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    res.json({ success: true, message: 'Batch assignment removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
