const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Assignment = require('../models/Assignment');
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
      const assignment = await Assignment.findOne({ userId, quizId });
      if (!assignment) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this quiz' });
      }

      // Prevent retaking a completed/terminated quiz
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
// @desc    Upload Excel to parse questions and create Quiz
// @access  Public/Admin
router.post('/parse-excel', upload.single('file'), async (req, res) => {
  try {
    console.log('--- Received Excel Upload ---');
    if (!req.file) {
      console.log('No file received');
      return res.status(400).json({ success: false, message: 'Please upload an Excel file' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    console.log(`Parsed ${data.length} rows from Excel`);

    const parsedQuestions = [];

    data.forEach((row, index) => {
      // Find keys case-insensitively to be more flexible
      const findKey = (search) => Object.keys(row).find(k => k.toLowerCase().trim() === search.toLowerCase().trim());
      
      const qKey = findKey('Question');
      const optAKey = findKey('Option A');
      const optBKey = findKey('Option B');
      const optCKey = findKey('Option C');
      const optDKey = findKey('Option D');
      const ansKey = findKey('Correct Answer');

      const qText = row[qKey];
      const optA = row[optAKey];
      const optB = row[optBKey];
      const optC = row[optCKey];
      const optD = row[optDKey];
      const correctChoice = row[ansKey]?.toString().trim().toUpperCase();

      if (qText && optA && optB && optD && correctChoice) {
        parsedQuestions.push({
          question: qText.toString().trim(),
          options: [
            optA.toString().trim(),
            optB.toString().trim(),
            optC ? optC.toString().trim() : '',
            optD.toString().trim()
          ].filter(o => o !== ''), // Allow 3 or 4 options
          correctAnswer: correctChoice, 
        });
      } else {
        console.log(`Row ${index + 1} skipped: Missing required fields`, { qText: !!qText, optA: !!optA, optB: !!optB, optD: !!optD, correctChoice });
      }
    });

    if (parsedQuestions.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid questions found in Excel. Check column names.' });
    }

    // Map correct answers to indices for frontend compatibility if they are letters
    const questionsForFrontend = parsedQuestions.map(q => {
      let correctIndex = q.correctAnswer;
      if (typeof q.correctAnswer === 'string') {
        const mapping = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
        if (mapping[q.correctAnswer.toUpperCase()] !== undefined) {
          correctIndex = mapping[q.correctAnswer.toUpperCase()];
        }
      }
      return { ...q, correctAnswer: correctIndex };
    });

    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB Offline. Saving to Simulation Storage.');
      const newQuiz = {
        _id: 'demo_uploaded_' + Date.now(),
        title: 'Uploaded Quiz (Simulation)',
        duration: 3600,
        questions: questionsForFrontend.map((q, i) => ({ ...q, _id: 'q_' + i })),
        createdAt: new Date(),
      };
      demoStore.quizzes.push(newQuiz);
      return res.status(201).json({ 
        success: true, 
        quiz: newQuiz, 
        questions: questionsForFrontend, 
        count: questionsForFrontend.length,
        message: 'Quiz created successfully (Simulation Mode)' 
      });
    }

    const newQuiz = await Quiz.create({
      title: 'Uploaded Quiz',
      duration: 3600, // Default to 1 hour for uploads
      questions: questionsForFrontend // Save as indices (will be cast to strings "0", "1" etc in DB)
    });

    console.log('Quiz saved to MongoDB successfully');
    res.status(201).json({ 
      success: true, 
      quiz: newQuiz, 
      questions: questionsForFrontend, 
      count: questionsForFrontend.length,
      message: 'Quiz created successfully' 
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
      const assignment = await Assignment.findOne({ userId, quizId });
      if (!assignment) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this quiz' });
      }
      if (assignment.status === 'COMPLETED' || assignment.status === 'TERMINATED') {
        return res.status(400).json({ success: false, message: 'You have already completed this assessment' });
      }
      if (assignment.status === 'NOT_STARTED') {
        assignment.status = 'IN_PROGRESS';
        assignment.startedAt = new Date();
        await assignment.save();
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
