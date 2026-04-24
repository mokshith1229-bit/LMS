const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Quiz = require('../models/Quiz');
const Assignment = require('../models/Assignment');
const mongoose = require('mongoose');
const demoStore = require('./demoStore');
const { protect } = require('../middleware/auth');

// @route   POST /api/submit
// @desc    Calculate score and save submission
// @access  Protected (student must be authenticated)
router.post('/', protect, async (req, res) => {
  try {
    const { quizId, answers, startTime, courseId } = req.body;
    const userId = req.user._id;
    const forcedReason = req.body.forcedReason || null;

    if (!quizId || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'quizId and answers array are required' });
    }

    const isDemo = quizId.toString().startsWith('demo');
    const isDbConnected = mongoose.connection.readyState === 1;

    // === ASSIGNMENT CHECK (only for real DB, non-demo) ===
    let assignment = null;
    if (isDbConnected && !isDemo && mongoose.Types.ObjectId.isValid(quizId)) {
      assignment = await Assignment.findOne({ userId, quizId });

      if (!assignment) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this quiz' });
      }

      // Prevent multiple submissions
      if (assignment.status === 'COMPLETED' || assignment.status === 'TERMINATED') {
        return res.status(400).json({ success: false, message: 'You have already submitted this assessment' });
      }
    }

    // Check for existing submission (only if DB is connected and not a demo)
    if (isDbConnected && !isDemo && mongoose.Types.ObjectId.isValid(quizId)) {
      try {
        const existingSubmission = await Submission.findOne({ userId, quizId });
        if (existingSubmission) {
          return res.status(400).json({ success: false, message: 'Already submitted' });
        }
      } catch (err) {
        console.error('Error checking existing submission:', err);
      }
    }

    let quiz;
    if (!isDbConnected || isDemo) {
      quiz = demoStore.quizzes.find(q => q._id === quizId);
    } else {
      quiz = await Quiz.findById(quizId);
    }

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Backend Timer Validation
    if (startTime && quiz.duration) {
      const endTime = Number(startTime) + (quiz.duration * 1000);
      // Allow a tiny 5s grace period for network latency
      if (Date.now() > endTime + 5000) {
        // Mark as TERMINATED due to timeout instead of rejecting
        if (assignment) {
          assignment.status = 'TERMINATED';
          assignment.submittedAt = new Date();
          await assignment.save();
        }
        return res.status(400).json({ success: false, message: 'Time expired' });
      }
    }

    // Rebuild the full answers array from sparse input (frontend sends only answered questions)
    const fullAnswers = new Array(quiz.questions.length).fill(null);
    answers.forEach(ans => {
      if (typeof ans === 'object' && ans !== null && ans.questionIndex !== undefined) {
        if (ans.questionIndex >= 0 && ans.questionIndex < fullAnswers.length) {
          fullAnswers[ans.questionIndex] = ans.selectedOption;
        }
      }
    });

    let correct = 0;
    let wrong = 0;
    let unattempted = 0;
    const total = quiz.questions.length;

    fullAnswers.forEach((ans, index) => {
      const q = quiz.questions[index];

      if (ans === null || ans === undefined || ans === '') {
        unattempted++;
      } else {
        const normalizedAns = ans.toString().trim().toUpperCase();
        const correctAnswer = q.correctAnswer.toString().trim().toUpperCase();

        if (normalizedAns === correctAnswer) {
          correct++;
        } else {
          wrong++;
        }
      }
    });

    const { timeTaken } = req.body;
    const percentage = total > 0 ? Number(((correct / total) * 100).toFixed(2)) : 0;
    const passed = percentage >= (quiz.passingScore || 60);

    // Determine final status
    const finalStatus = forcedReason === 'violation' ? 'TERMINATED' : 'COMPLETED';

    const stats = {
      total,
      correct,
      score: correct,
      wrong,
      unattempted,
      percentage,
      timeTaken: timeTaken || 0,
      passed,
      status: finalStatus,
      submittedAt: new Date(),
    };

    let savedSubmission = null;
    if (isDbConnected && !isDemo) {
      savedSubmission = await Submission.create({
        userId,
        quizId,
        answers: fullAnswers,
        ...stats
      });

      // Update assignment status
      if (assignment) {
        assignment.status = finalStatus;
        assignment.submittedAt = new Date();
        await assignment.save();
      }
    } else {
      // Mock submission object for simulation mode
      savedSubmission = {
        _id: 'sim_' + Date.now(),
        userId,
        quizId,
        answers: fullAnswers,
        ...stats
      };
    }

    // === ROLE-BASED RESPONSE ===
    // Students only see status, not scores
    const isStudent = req.user.role === 'student';

    if (isStudent) {
      return res.status(201).json({
        success: true,
        status: 'submitted',
        submissionStatus: finalStatus,
        submission: {
          _id: savedSubmission._id,
          quizId,
          status: finalStatus,
          submittedAt: savedSubmission.submittedAt,
        },
      });
    }

    // Admin gets full stats
    res.status(201).json({
      success: true,
      submission: savedSubmission,
      ...stats,
    });

  } catch (error) {
    console.error('Submission Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
