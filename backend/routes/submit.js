const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Quiz = require('../models/Quiz');
const Assignment = require('../models/Assignment');
const mongoose = require('mongoose');
const demoStore = require('./demoStore');
const { protect } = require('../middleware/auth');

function processSubmission({ quiz, answers }) {
  let correct = 0;
  let wrong = 0;

  const formattedAnswers = quiz.questions.map((q, index) => {
    // Check old sparse format vs new dense format
    let userAnswer = null;
    
    // Support both `[{ questionIndex: 0, selectedOption: 1 }]` and `[1, null, 2]`
    if (answers && answers.length > 0 && typeof answers[0] === 'object' && answers[0] !== null && 'questionIndex' in answers[0]) {
      const match = answers.find(a => a.questionIndex === index);
      if (match) userAnswer = match.selectedOption;
    } else if (Array.isArray(answers) && index < answers.length) {
      userAnswer = answers[index];
    }

    if (userAnswer === null || userAnswer === undefined || userAnswer === '') {
      return {
        questionId: q._id.toString(),
        selectedOption: null
      };
    }

    const normalizedAns = userAnswer.toString().trim().toUpperCase();
    const correctAnswer = q.correctAnswer.toString().trim().toUpperCase();

    if (normalizedAns === correctAnswer) {
      correct++;
    } else {
      wrong++;
    }

    return {
      questionId: q._id.toString(),
      selectedOption: userAnswer.toString()
    };
  });

  const total = quiz.questions.length;
  const unattempted = total - (correct + wrong);
  const percentage = total > 0 ? Number(((correct / total) * 100).toFixed(2)) : 0;

  return {
    formattedAnswers,
    correct,
    wrong,
    unattempted,
    percentage,
    total
  };
}

// @route   POST /api/submit
// @desc    Calculate score and save submission
// @access  Protected (student must be authenticated)
router.post('/', protect, async (req, res) => {
  try {
    const { quizId, answers, startTime, courseId, autoSubmit } = req.body;
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

      // Prevent multiple submissions if manually requested, but allow autoSubmit to finalize
      if ((assignment.status === 'COMPLETED' || assignment.status === 'TERMINATED') && !autoSubmit) {
        return res.status(400).json({ success: false, message: 'You have already submitted this assessment' });
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
    if (startTime && quiz.duration && !autoSubmit) {
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

    // SHARED SCORING FUNCTION
    const result = processSubmission({ quiz, answers });

    const { timeTaken } = req.body;
    const passed = result.percentage >= (quiz.passingScore || 60);

    // Determine final status
    const finalStatus = forcedReason === 'violation' ? 'TERMINATED' : 'COMPLETED';

    const stats = {
      total: result.total,
      correct: result.correct,
      score: result.correct,
      wrong: result.wrong,
      unattempted: result.unattempted,
      percentage: result.percentage,
      timeTaken: timeTaken || 0,
      passed,
      status: finalStatus,
      submittedAt: new Date(),
    };

    let savedSubmission = null;
    if (isDbConnected && !isDemo) {
      // Find and update, or create if not exists
      savedSubmission = await Submission.findOneAndUpdate(
        { userId, quizId },
        {
          userId,
          quizId,
          answers: result.formattedAnswers,
          ...stats
        },
        { new: true, upsert: true }
      );

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
        answers: result.formattedAnswers,
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
