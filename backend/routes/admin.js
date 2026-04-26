const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/role');
const xlsx = require('xlsx');

// All admin routes require authentication + admin role
router.use(protect, checkRole('admin'));

// @route   POST /api/admin/assign
// @desc    Assign a quiz to a user by email
// @access  Admin only
router.post('/assign', async (req, res) => {
  try {
    const { email, quizId } = req.body;

    if (!email || !quizId) {
      return res.status(400).json({ success: false, message: 'email and quizId are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({ success: false, message: 'Invalid quizId' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found with that email' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Prevent duplicate assignments
    const existing = await Assignment.findOne({ userId: user._id, quizId });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Quiz already assigned to this user' });
    }

    const assignment = await Assignment.create({
      userId: user._id,
      quizId,
      status: 'NOT_STARTED',
    });

    res.status(201).json({
      success: true,
      message: `Quiz "${quiz.title}" assigned to ${user.email}`,
      assignment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/admin/results
// @desc    Get all submission results with user and quiz info
// @access  Admin only
router.get('/results', async (req, res) => {
  try {
    const submissions = await Submission.find({})
      .populate('userId', 'email name')
      .populate({
        path: 'quizId',
        select: 'title courseId',
        populate: { path: 'courseId', select: 'title' }
      })
      .sort({ submittedAt: -1 })
      .lean();

    const results = submissions.map((sub) => {
      return {
        submissionId: sub._id.toString(),
        userName: sub.userId?.name || 'Unknown',
        userEmail: sub.userId?.email || '',
        userMobile: sub.userId?.mobile || '',
        quizTitle: sub.quizId?.title || 'Unknown',
        courseTitle: sub.quizId?.courseId?.title || '',
        correct: sub.correct,
        wrong: sub.wrong,
        unattempted: sub.unattempted,
        total: sub.correct + sub.wrong + sub.unattempted,
        percentage: sub.percentage,
        passed: sub.passed,
        timeTaken: sub.timeTaken,
        status: sub.status || 'COMPLETED',
        submittedAt: sub.submittedAt,
      };
    });

    res.json({ success: true, results, count: results.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/admin/results/export
// @desc    Export results as Excel
// @access  Admin only
router.get('/results/export', async (req, res) => {
  try {
    const submissions = await Submission.find({})
      .populate('userId', 'email name')
      .populate({
        path: 'quizId',
        select: 'title courseId',
        populate: { path: 'courseId', select: 'title' }
      })
      .sort({ submittedAt: -1 })
      .lean();

    const data = submissions.map((s) => ({
      'Student Name': s.userId?.name || 'Unknown',
      'Email': s.userId?.email || '',
      'Quiz Title': s.quizId?.title || 'Unknown',
      'Course': s.quizId?.courseId?.title || '',
      'Correct Answers': s.correct,
      'Wrong Answers': s.wrong,
      'Unattempted': s.unattempted,
      'Total Questions': s.correct + s.wrong + s.unattempted,
      'Percentage (%)': s.percentage,
      'Result': s.passed ? 'PASS' : 'FAIL',
      'Status': s.status || 'COMPLETED',
      'Time Taken (secs)': s.timeTaken,
      'Submitted At': s.submittedAt ? new Date(s.submittedAt).toLocaleString() : 'N/A'
    }));

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Assessment Results');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=LMS_Assessment_Results.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// @desc    Get all assignments with user and quiz info
// @access  Admin only
router.get('/assignments', async (req, res) => {
  try {
    const assignments = await Assignment.find({})
      .populate('userId', 'email name')
      .populate({
        path: 'quizId',
        select: 'title duration courseId',
        populate: { path: 'courseId', select: 'title' }
      })
      .sort({ assignedAt: -1 })
      .lean();

    res.json({ success: true, assignments, count: assignments.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/admin/users
// @desc    Get all student users (supports ?query= search by name or email)
// @access  Admin only
router.get('/users', async (req, res) => {
  try {
    const { query } = req.query;
    const filter = { role: 'student' };

    if (query && query.trim()) {
      const regex = new RegExp(query.trim(), 'i');
      filter.$or = [{ name: regex }, { email: regex }];
    }

    const users = await User.find(filter)
      .select('_id name email createdAt')
      .sort({ createdAt: -1 });

    res.json({ success: true, users, count: users.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/admin/assign-batch
// @desc    Assign a quiz to multiple users at once
// @access  Admin only
router.post('/assign-batch', async (req, res) => {
  try {
    const { userIds, quizId } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'userIds must be a non-empty array' });
    }
    if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({ success: false, message: 'Valid quizId is required' });
    }

    // Validate all userIds are valid ObjectIds
    const invalidIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ success: false, message: `Invalid user IDs: ${invalidIds.join(', ')}` });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Find which assignments already exist in one query
    const existingAssignments = await Assignment.find(
      { userId: { $in: userIds }, quizId },
      { userId: 1 }
    ).lean();

    const alreadyAssignedSet = new Set(
      existingAssignments.map(a => a.userId.toString())
    );

    const toCreate = userIds.filter(id => !alreadyAssignedSet.has(id.toString()));
    const skippedCount = userIds.length - toCreate.length;

    let assignedCount = 0;
    if (toCreate.length > 0) {
      const docs = toCreate.map(userId => ({
        userId,
        quizId,
        status: 'NOT_STARTED',
        assignedAt: new Date(),
      }));
      const result = await Assignment.insertMany(docs, { ordered: false });
      assignedCount = result.length;
    }

    res.status(201).json({
      success: true,
      assignedCount,
      skippedCount,
      message: `${assignedCount} assigned, ${skippedCount} skipped (already assigned)`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/admin/assign/:assignmentId
// @desc    Remove an assignment
// @access  Admin only
router.delete('/assign/:assignmentId', async (req, res) => {
  try {
    const assignment = await Assignment.findByIdAndDelete(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    res.json({ success: true, message: 'Assignment removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/admin/submissions/debug
// @desc    List last 10 submission IDs for debugging
// @access  Admin only
router.get('/submissions/debug', async (req, res) => {
  try {
    const subs = await Submission.find({}).sort({ submittedAt: -1 }).limit(10).lean();
    res.json({
      success: true,
      count: subs.length,
      ids: subs.map(s => ({ _id: s._id.toString(), userId: s.userId?.toString(), submittedAt: s.submittedAt }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/admin/submissions/:id
// @desc    Get detailed submission answers for admin review
// @access  Admin only
router.get('/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId before querying
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: `Invalid submission ID: ${id}` });
    }

    const submission = await Submission.findById(id)
      .populate('userId', 'name email')
      .populate('quizId');

    if (!submission) {
      return res.status(404).json({ success: false, message: `Submission with ID ${id} not found. It may have been deleted or not yet saved.` });
    }

    const quiz = submission.quizId;
    const user = submission.userId;

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz associated with this submission no longer exists.' });
    }

    // Map answers to include question text and options
    const answers = quiz.questions.map((q) => {
      const userAnswerObj = submission.answers.find(a => a.questionId === q._id.toString());
      const userAnswer = userAnswerObj ? userAnswerObj.selectedOption : null;
      const correctAnswer = q.correctAnswer.toString().trim();
      const isCorrect = userAnswer !== null && userAnswer.toString().trim().toUpperCase() === correctAnswer.toUpperCase();

      return {
        question: q.question,
        options: q.options,
        correctAnswer,
        userAnswer,
        isCorrect,
        isUnattempted: userAnswer === null
      };
    });

    res.json({
      success: true,
      user: { name: user?.name || 'Unknown', email: user?.email || '' },
      quizTitle: quiz.title,
      correct: submission.correct,
      wrong: submission.wrong,
      unattempted: submission.unattempted,
      percentage: submission.percentage,
      status: submission.status,
      submittedAt: submission.submittedAt,
      answers
    });
  } catch (error) {
    console.error('Submission View Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
