const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const Module = require('../models/Module');
const Course = require('../models/Course');
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/role');
const demoStore = require('./demoStore');
const multer = require('multer');
const xlsx = require('xlsx');

const upload = multer({ storage: multer.memoryStorage() });

// @route   POST /api/quiz/parse-excel
// @access  Admin only
router.post('/parse-excel', protect, checkRole('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an Excel file' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ success: false, message: 'The Excel file is empty' });
    }

    const questions = [];
    const errors = [];

    data.forEach((row, index) => {
      const qText = row['Question'];
      const optA = row['Option A'];
      const optB = row['Option B'];
      const optC = row['Option C'];
      const optD = row['Option D'];
      const correctChoice = row['Correct Answer']?.toString().trim().toUpperCase();

      if (!qText || !optA || !optB || !optC || !optD || !correctChoice) {
        errors.push(`Row ${index + 2}: Missing required columns`);
        return;
      }

      const letterMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
      if (!(correctChoice in letterMap)) {
        errors.push(`Row ${index + 2}: Invalid Correct Answer (must be A, B, C, or D)`);
        return;
      }

      questions.push({
        question: qText,
        options: [optA, optB, optC, optD],
        correctAnswer: letterMap[correctChoice]
      });
    });

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    res.json({ success: true, questions, count: questions.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// @route   POST /api/quiz
// @access  Admin only
router.post('/', protect, checkRole('admin'), async (req, res) => {
  try {
    const { courseId, title, questions, timeLimitSeconds, passingScore } = req.body;

    if (!courseId || !title || !questions || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'courseId, title, and at least one question are required',
      });
    }

    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1 || courseId.startsWith('demo') || courseId.startsWith('mock')) {
      const mockQuiz = {
        _id: 'demo_quiz_' + Date.now(),
        courseId,
        title,
        questions,
        timeLimitSeconds: timeLimitSeconds || 600,
        passingScore: passingScore || 60,
      };

      const mockModule = {
        _id: 'demo_mod_' + Date.now(),
        courseId,
        title,
        type: 'quiz',
        quizId: mockQuiz._id,
      };


      // Persistence logic for demoStore
      demoStore.quizzes.push(mockQuiz);
      demoStore.modules.push(mockModule);
      
      const targetCourse = demoStore.courses.find(c => c._id === courseId);
      if (targetCourse) {
        targetCourse.modules.push(mockModule._id);
      }

      return res.status(201).json({
        success: true,
        message: 'Quiz created successfully (Simulation Mode)',
        quiz: mockQuiz,
        module: mockModule
      });
    }


    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const quiz = await Quiz.create({
      courseId,
      title,
      questions,
      timeLimitSeconds: timeLimitSeconds || 600,
      passingScore: passingScore || 60,
    });

    const module = await Module.create({
      courseId,
      title,
      type: 'quiz',
      quizId: quiz._id,
      order: course.modules.length,
    });

    course.modules.push(module._id);
    await course.save();

    res.status(201).json({ success: true, quiz, module });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/quiz/single/:quizId
// @access  Private
router.get('/single/:quizId', protect, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    if (mongoose.connection.readyState !== 1 || req.params.quizId.startsWith('demo') || req.params.quizId.startsWith('mock')) {
      const quiz = demoStore.quizzes.find(q => q._id === req.params.quizId);
      
      if (!quiz) {
        return res.status(404).json({ success: false, message: 'Assessment not found in simulation data' });
      }


      let responseQuiz = { ...quiz };
      if (req.user.role === 'student') {
        responseQuiz.questions = responseQuiz.questions.map(q => ({
          _id: q._id,
          question: q.question,
          options: q.options
        }));
      }
      return res.json({ success: true, quiz: responseQuiz });
    }

    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    let responseQuiz = quiz.toObject();
    if (req.user.role === 'student') {
      responseQuiz.questions = responseQuiz.questions.map((q) => ({
        _id: q._id,
        question: q.question,
        options: q.options,
      }));
    }

    res.json({ success: true, quiz: responseQuiz });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
