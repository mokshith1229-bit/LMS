const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/role');
const mongoose = require('mongoose');

// Admin only routes
router.use(protect, checkRole('admin'));

// @route   POST /api/batch
// @desc    Create a new batch
// @access  Admin
router.post('/', async (req, res) => {
  try {
    const { name, users } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Batch name is required' });
    }

    const existingBatch = await Batch.findOne({ name });
    if (existingBatch) {
      return res.status(400).json({ success: false, message: 'Batch name already exists' });
    }

    let validUsers = [];
    if (users && Array.isArray(users)) {
      validUsers = users.filter((id) => mongoose.Types.ObjectId.isValid(id));
    }

    const batch = await Batch.create({
      name,
      users: validUsers,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, batch, message: 'Batch created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/batch
// @desc    Get all batches
// @access  Admin
router.get('/', async (req, res) => {
  try {
    const batches = await Batch.find()
      .populate('users', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, batches, count: batches.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/batch/:batchId/quizzes
// @desc    Get all quizzes assigned to a specific batch via BatchAssignment
// @access  Admin
// NOTE: This route MUST be registered before /:batchId to avoid param clash
router.get('/:batchId/quizzes', async (req, res) => {
  try {
    const { batchId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ success: false, message: 'Invalid batch ID' });
    }

    const BatchAssignment = require('../models/BatchAssignment');

    const assignments = await BatchAssignment.find({ batchId })
      .populate({
        path: 'quizId',
        select: 'title duration questions passingScore courseId',
        populate: { path: 'courseId', select: 'title' }
      })
      .sort({ createdAt: -1 });

    // Filter out orphaned assignments where quiz was deleted
    const quizzes = assignments
      .filter(a => a.quizId)
      .map(a => ({
        _id: a.quizId._id,
        title: a.quizId.title,
        duration: a.quizId.duration,
        questionCount: a.quizId.questions?.length || 0,
        passingScore: a.quizId.passingScore,
        courseTitle: a.quizId.courseId?.title || '',
        startTime: a.startTime,
        endTime: a.endTime,
        isActive: a.isActive,
        assignmentId: a._id,
      }));

    res.json({ success: true, quizzes, count: quizzes.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/batch/:batchId
// @desc    Get a single batch with its users
// @access  Admin
router.get('/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ success: false, message: 'Invalid batch ID' });
    }

    const batch = await Batch.findById(batchId)
      .populate('users', 'name email')
      .populate('createdBy', 'name email');

    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    res.json({ success: true, batch });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/batch/:id/users
// @desc    Add or update users in a batch
// @access  Admin
router.put('/:id/users', async (req, res) => {
  try {
    const { id } = req.params;
    const { users } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid batch ID' });
    }

    if (!Array.isArray(users)) {
      return res.status(400).json({ success: false, message: 'Users must be an array' });
    }

    const validUsers = users.filter((userId) => mongoose.Types.ObjectId.isValid(userId));

    const batch = await Batch.findByIdAndUpdate(
      id,
      { users: validUsers },
      { new: true }
    ).populate('users', 'name email');

    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    res.json({ success: true, batch, message: 'Batch users updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
