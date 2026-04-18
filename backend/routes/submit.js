const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Quiz = require('../models/Quiz');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/role');
const demoStore = require('./demoStore');
const mongoose = require('mongoose');

// @route   POST /api/submit
// @access  Student only
router.post('/', protect, checkRole('student'), async (req, res) => {
  try {
    const { quizId, courseId, answers, timeTaken } = req.body;

    if (!quizId || !courseId || !answers) {
      return res.status(400).json({ success: false, message: 'quizId, courseId, and answers are required' });
    }

    // --- Simulation Handling ---
    if (mongoose.connection.readyState !== 1 || quizId.startsWith('demo') || quizId.startsWith('mock')) {
      const quiz = demoStore.quizzes.find(q => q._id === quizId);
      
      if (!quiz) {
        return res.status(404).json({ success: false, message: 'Assessment not found in simulation data' });
      }


      // Grade provided answers
      let score = 0;
      const total = quiz.questions.length;

      answers.forEach((ans) => {
        const question = quiz.questions[ans.questionIndex];
        if (question && question.correctAnswer === ans.selectedOption) {
          score++;
        }
      });

      const percentage = Math.round((score / total) * 100);
      const passed = percentage >= (quiz.passingScore || 60);

      return res.status(201).json({
        success: true,
        submission: {
          _id: 'demo_sub_' + Date.now(),
          score,
          total,
          percentage,
          passed,
          timeTaken: timeTaken || 0,
          createdAt: new Date(),
        },
      });
    }

    // ----------------------------

    // Check if already submitted
    const existing = await Submission.findOne({ userId: req.user._id, quizId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted this quiz',
        submission: existing,
      });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Grade answers
    let score = 0;
    const total = quiz.questions.length;

    const gradedAnswers = answers.map((ans) => {
      const question = quiz.questions[ans.questionIndex];
      const isCorrect = question && question.correctAnswer === ans.selectedOption;
      if (isCorrect) score++;
      return { questionIndex: ans.questionIndex, selectedOption: ans.selectedOption };
    });

    const percentage = Math.round((score / total) * 100);
    const passed = percentage >= (quiz.passingScore || 60);

    const submission = await Submission.create({
      userId: req.user._id,
      courseId,
      quizId,
      answers: gradedAnswers,
      score,
      total,
      percentage,
      passed,
      timeTaken: timeTaken || 0,
    });

    // Track course completion in User
    const user = await User.findById(req.user._id);
    const enrollment = user.enrolledCourses.find(
      (e) => e.courseId.toString() === courseId
    );
    if (passed) {
      if (enrollment) {
        enrollment.completedAt = new Date();
        await user.save();
      }
    }

    res.status(201).json({
      success: true,
      submission: {
        _id: submission._id,
        score,
        total,
        percentage,
        passed,
        timeTaken: submission.timeTaken,
        createdAt: submission.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/submit/my/:courseId
// @access  Student
router.get('/my/:courseId', protect, checkRole('student'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, submission: null });
    }
    const submission = await Submission.findOne({
      userId: req.user._id,
      courseId: req.params.courseId,
    }).sort({ createdAt: -1 });

    res.json({ success: true, submission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// @route   GET /api/submit/results/:courseId
// @access  Admin
router.get('/results/:courseId', protect, checkRole('admin'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, submissions: [] });
    }
    const submissions = await Submission.find({ courseId: req.params.courseId })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, submissions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


module.exports = router;
