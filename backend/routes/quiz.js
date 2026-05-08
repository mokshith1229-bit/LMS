const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Batch = require('../models/Batch');
const BatchAssignment = require('../models/BatchAssignment');
const multer = require('multer');
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const demoStore = require('./demoStore');
const { protect } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// @route   POST /api/quiz
// @desc    Create a new quiz
// @access  Public/Admin
router.post('/', async (req, res) => {
  try {
    const { courseId, title, questions, timeLimitSeconds, passingScore } = req.body;

    if (mongoose.connection.readyState !== 1 || courseId.startsWith('demo')) {
      const newQuiz = {
        _id: 'demo_quiz_' + Date.now(),
        courseId,
        title,
        questions: questions.map((q, i) => ({ ...q, _id: 'q_' + i })),
        timeLimitSeconds,
        passingScore,
        createdAt: new Date(),
      };
      
      demoStore.quizzes.push(newQuiz);

      const course = demoStore.courses.find(c => c._id === courseId);
      if (course) {
        const order = course.modules ? course.modules.length : 0;
        const newMod = {
          _id: 'demo_mod_' + Date.now(),
          courseId,
          title: title,
          type: 'quiz',
          quizId: newQuiz._id,
          order
        };
        demoStore.modules.push(newMod);
        if (!course.modules) course.modules = [];
        course.modules.push(newMod._id);
      }

      return res.status(201).json({ success: true, quiz: newQuiz, message: 'Quiz created dynamically (Simulation)' });
    }

    const quiz = await Quiz.create({
      courseId,
      title,
      questions,
      duration: timeLimitSeconds || 1800,
      passingScore,
    });

    // Also push a module for this quiz
    const course = await Course.findById(courseId);
    if (course) {
      const order = course.modules ? course.modules.length : 0;
      const mod = await Module.create({
        courseId,
        title: title,
        type: 'quiz',
        quizId: quiz._id,
        order
      });
      course.modules.push(mod._id);
      await course.save();
    }

    res.status(201).json({ success: true, quiz });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/quiz
// @desc    Fetch all quizzes
// @access  Public
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json(demoStore.quizzes);
    }
    const quizzes = await Quiz.find({}).populate('courseId', 'title').sort({ _id: 1 });
    res.json([...demoStore.quizzes, ...quizzes]);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/quiz/:quizId
// @desc    Fetch a single quiz by ID (checks assignment for real DB)
// @access  Protected
router.get('/:quizId', protect, async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user._id;
    
    // Support demo mode fallback if needed
    if (mongoose.connection.readyState !== 1 || quizId.startsWith('demo')) {
      const demoQuiz = demoStore.quizzes.find(q => q._id === quizId);
      if (demoQuiz) {
        const cleanQuestions = demoQuiz.questions.map(q => ({
          question: q.question,
          options: q.options
        }));
        return res.json({ 
          quizId: demoQuiz._id,
          title: demoQuiz.title,
          duration: demoQuiz.duration || demoQuiz.timeLimitSeconds || 1800,
          questions: cleanQuestions,
          startTime: Date.now()
        });
      }
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // === ASSIGNMENT CHECK (real DB only) ===
    if (mongoose.Types.ObjectId.isValid(quizId) && req.user.role === 'student') {
      let assignment = await Assignment.findOne({ userId, quizId });

      if (!assignment) {
        // Check batch assignment
        const userBatches = await Batch.find({ users: userId }).select('_id');
        const batchIds = userBatches.map(b => b._id);
        
        const batchAssigned = await BatchAssignment.findOne({
          quizId,
          batchId: { $in: batchIds },
          isActive: true
        });

        if (!batchAssigned) {
          return res.status(403).json({ success: false, message: 'You are not assigned to this quiz' });
        }

        const now = new Date();
        if (now < new Date(batchAssigned.startTime)) {
          return res.status(403).json({ success: false, message: 'This quiz is scheduled for a future time' });
        }
        if (now > new Date(batchAssigned.endTime)) {
          return res.status(403).json({ success: false, message: 'The schedule for this quiz has expired' });
        }

        // Check if already submitted
        const submission = await Submission.findOne({ userId, quizId, batchId: batchAssigned.batchId });
        if (submission && (submission.status === 'COMPLETED' || submission.status === 'TERMINATED')) {
          return res.status(400).json({ success: false, message: 'You have already completed this assessment' });
        }
      } else {
        // Prevent retaking a completed/terminated individual quiz
        if (assignment.status === 'COMPLETED' || assignment.status === 'TERMINATED') {
          return res.status(400).json({ success: false, message: 'You have already completed this assessment' });
        }

        // Transition NOT_STARTED → IN_PROGRESS
        if (assignment.status === 'NOT_STARTED') {
          assignment.status = 'IN_PROGRESS';
          assignment.startedAt = new Date();
          await assignment.save();
        }
      }
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Strip correct answers before sending to student
    const cleanQuestions = quiz.questions.map(q => ({
      _id: q._id,
      question: q.question,
      options: q.options
    }));

    res.json({
      quizId: quiz._id,
      title: quiz.title,
      duration: quiz.duration,
      questions: cleanQuestions,
      startTime: Date.now()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/quiz/parse-excel
// @desc    Upload Excel to parse questions — delegates to shared importQuestionParser
// @access  Public/Admin
// NOTE: Prefer POST /api/import/parse-excel?mode=quiz for new callers.
//       This endpoint is kept for backward compatibility.
router.post('/parse-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an Excel file' });
    }

    const { parseExcelQuestions } = require('../shared/importQuestionParser');
    const { questions, errors, count } = await parseExcelQuestions(
      req.file.buffer,
      { mode: 'quiz', uploadImages: true }
    );

    return res.status(200).json({
      success: true,
      questions,
      count,
      errors,
      message: `${count} question(s) parsed successfully${
        errors.length ? ` (${errors.length} row(s) skipped)` : ''
      }`,
    });
  } catch (error) {
    console.error('Excel Parse Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/quiz/single/:quizId (Legacy support - used by AssessmentPage)
// @desc    Alias for GET /api/quiz/:quizId with assignment check
// @access  Protected
router.get('/single/:quizId', protect, async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user._id;
    
    // Support demo mode fallback
    if (mongoose.connection.readyState !== 1 || quizId.startsWith('demo')) {
      const demoQuiz = demoStore.quizzes.find(q => q._id === quizId);
      if (demoQuiz) {
        // Strip correct answers for demo too
        const cleanQuiz = {
          ...demoQuiz,
          questions: demoQuiz.questions.map(q => ({
            _id: q._id,
            question: q.question,
            options: q.options,
            timeLimitSeconds: demoQuiz.timeLimitSeconds,
          })),
        };
        return res.json({ success: true, quiz: cleanQuiz });
      }
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // === ASSIGNMENT CHECK for students (real DB) ===
    if (mongoose.Types.ObjectId.isValid(quizId) && req.user.role === 'student') {
      let assignment = await Assignment.findOne({ userId, quizId });

      if (!assignment) {
        // Check batch assignment
        const userBatches = await Batch.find({ users: userId }).select('_id');
        const batchIds = userBatches.map(b => b._id);
        
        const batchAssigned = await BatchAssignment.findOne({
          quizId,
          batchId: { $in: batchIds },
          isActive: true
        });

        if (!batchAssigned) {
          return res.status(403).json({ success: false, message: 'You are not assigned to this quiz' });
        }

        const now = new Date();
        if (now < new Date(batchAssigned.startTime)) {
          return res.status(403).json({ success: false, message: 'This quiz is scheduled for a future time' });
        }
        if (now > new Date(batchAssigned.endTime)) {
          return res.status(403).json({ success: false, message: 'The schedule for this quiz has expired' });
        }

        // Check if already submitted
        const submission = await Submission.findOne({ userId, quizId, batchId: batchAssigned.batchId });
        if (submission && (submission.status === 'COMPLETED' || submission.status === 'TERMINATED')) {
          return res.status(400).json({ success: false, message: 'You have already completed this assessment' });
        }
      } else {
        if (assignment.status === 'COMPLETED' || assignment.status === 'TERMINATED') {
          return res.status(400).json({ success: false, message: 'You have already completed this assessment' });
        }
        if (assignment.status === 'NOT_STARTED') {
          assignment.status = 'IN_PROGRESS';
          assignment.startedAt = new Date();
          await assignment.save();
        }
      }
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Strip correct answers — students never see them
    const cleanQuiz = {
      _id: quiz._id,
      title: quiz.title,
      duration: quiz.duration,
      timeLimitSeconds: quiz.duration,
      passingScore: quiz.passingScore,
      questions: quiz.questions.map(q => ({
        _id: q._id,
        question: q.question,
        options: q.options,
      })),
    };

    res.json({ success: true, quiz: cleanQuiz });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
