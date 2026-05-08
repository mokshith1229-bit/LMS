const express = require('express');
const router = express.Router();
const Assignment = require('../models/Assignment');
const Quiz = require('../models/Quiz');
const Batch = require('../models/Batch');
const BatchAssignment = require('../models/BatchAssignment');
const Submission = require('../models/Submission');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// @route   GET /api/assignments/my
// @desc    Get all quizzes assigned to the logged-in student (Individual + Batch)
// @access  Student
router.get('/my', async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Fetch Individual Assignments
    const individualAssignments = await Assignment.find({ userId })
      .populate('quizId', 'title duration passingScore')
      .sort({ assignedAt: -1 })
      .lean();

    // 2. Fetch Batch Assignments
    // First, find batches the user belongs to
    const userBatches = await Batch.find({ users: userId }).select('_id');
    const batchIds = userBatches.map(b => b._id);

    // Find all active batch assignments for these batches
    const batchAssignments = await BatchAssignment.find({
      batchId: { $in: batchIds },
      isActive: true
    })
      .populate('quizId', 'title duration passingScore')
      .lean();

    // 3. Aggregate all unique quizzes
    const assignmentsMap = new Map();

    // Process individual assignments first
    individualAssignments.forEach(a => {
      if (!a.quizId) return;
      assignmentsMap.set(a.quizId._id.toString(), {
        assignmentId: a._id,
        quizId: a.quizId._id,
        title: a.quizId.title,
        duration: a.quizId.duration,
        passingScore: a.quizId.passingScore,
        status: a.status,
        assignedAt: a.assignedAt,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        type: 'individual'
      });
    });

    // Process batch assignments
    for (const ba of batchAssignments) {
      if (!ba.quizId) continue;
      const qId = ba.quizId._id.toString();

      // If already added via individual assignment, we skip or update? 
      // Usually individual assignment takes precedence or they are separate.
      // For LMS consistency, let's only add if not already present.
      if (!assignmentsMap.has(qId)) {
        // Check for submission for this specific batch quiz
        const submission = await Submission.findOne({ userId, quizId: ba.quizId._id, batchId: ba.batchId });
        
        assignmentsMap.set(qId, {
          assignmentId: ba._id, // Use BatchAssignment ID
          quizId: ba.quizId._id,
          title: ba.quizId.title,
          duration: ba.quizId.duration,
          passingScore: ba.quizId.passingScore,
          status: submission ? submission.status : 'NOT_STARTED',
          assignedAt: ba.createdAt,
          submittedAt: submission ? submission.submittedAt : null,
          startTime: ba.startTime,
          endTime: ba.endTime,
          type: 'batch'
        });
      }
    }

    const result = Array.from(assignmentsMap.values()).sort((a, b) => 
      new Date(b.assignedAt) - new Date(a.assignedAt)
    );

    res.json({ success: true, assignments: result, count: result.length });
  } catch (error) {
    console.error('[assignments/my] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
