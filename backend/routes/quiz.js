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
const { generatePaper } = require('../utils/paperGenerator');

const upload = multer({ storage: multer.memoryStorage() });

// ── Helper: Build clean student-facing question list from attemptPaper snapshot
// Strips correctAnswer before sending to the student.
function buildQuestionsFromSnapshot(attemptPaper) {
  return attemptPaper.map(item => ({
    _id: item.questionId,           // use original questionId as _id so submit/analytics work
    question: item.questionText,
    options: item.shuffledOptions,  // shuffled order
    imageUrl: item.imageUrl || '',
  }));
}

// ── Helper: Attach or restore the attempt paper snapshot on an assignment ────
// Returns the updated assignment (with attemptPaper populated).
// Throws on paper generation failure.
async function ensureAttemptPaper(assignment, quiz) {
  // Already generated → restore frozen paper (handles refresh/reconnect)
  if (assignment.attemptPaper && assignment.attemptPaper.length > 0) {
    return assignment;
  }

  // First access → generate paper and freeze it
  const paper = generatePaper(quiz);
  assignment.attemptPaper = paper;
  await assignment.save();
  return assignment;
}

// @route   POST /api/quiz
// @desc    Create a new quiz
// @access  Public/Admin
router.post('/', async (req, res) => {
  try {
    const {
      courseId,
      title,
      questions,
      timeLimitSeconds,
      passingScore,
      instructions,
      questionsPerStudent,
      shuffleQuestions,
      shuffleOptions,
      sectionDistribution,
    } = req.body;

    // ── Prevent duplicate questions ───────────────────────────────────────────
    if (questions && Array.isArray(questions)) {
      const seenQuestions = new Set();
      for (const q of questions) {
        if (q && q.question) {
          const text = q.question.trim().toLowerCase();
          if (seenQuestions.has(text)) {
            return res.status(400).json({
              success: false,
              message: `Duplicate question found: "${q.question}"`,
            });
          }
          seenQuestions.add(text);
        }
      }
    }

    // ── Validate randomization config ─────────────────────────────────────────
    if (questionsPerStudent && questions && questionsPerStudent > questions.length) {
      return res.status(400).json({
        success: false,
        message: `questionsPerStudent (${questionsPerStudent}) cannot exceed the master pool size (${questions.length} questions).`,
      });
    }

    // ── Validate section distribution ──────────────────────────────────────────
    if (sectionDistribution && sectionDistribution.length > 0) {
      if (!questions || !Array.isArray(questions)) {
        return res.status(400).json({
          success: false,
          message: 'Questions pool is required when section distribution is configured.',
        });
      }

      // Calculate pool sizes for each section in the questions array
      const poolSizes = {};
      questions.forEach(q => {
        const sec = (q.section || '').trim();
        poolSizes[sec] = (poolSizes[sec] || 0) + 1;
      });

      // Validate each entry in sectionDistribution
      for (const dist of sectionDistribution) {
        const secName = (dist.section || '').trim();
        
        // Ensure section name is not empty
        if (!secName) {
          return res.status(400).json({
            success: false,
            message: "Section name in distribution configuration cannot be empty."
          });
        }

        // Ensure all configured sections exist in the question pool
        if (!(secName in poolSizes)) {
          return res.status(400).json({
            success: false,
            message: `Configured section "${secName}" does not exist in the uploaded questions pool.`
          });
        }

        const poolSize = poolSizes[secName];
        const toDeliver = dist.questionsToDeliver;

        // Ensure questions to deliver is positive
        if (toDeliver <= 0) {
          return res.status(400).json({
            success: false,
            message: `Questions to deliver for section "${secName}" must be greater than 0.`
          });
        }

        // Validate: Questions To Deliver <= Section Pool Size
        if (toDeliver > poolSize) {
          return res.status(400).json({
            success: false,
            message: `Questions to deliver for section "${secName}" (${toDeliver}) cannot exceed its pool size (${poolSize}).`
          });
        }
      }
    }

    // ── Upsert Categories ─────────────────────────────────────────────────────
    // To support automatic mapping from Excel bulk import, we extract unique 
    // sections from the questions array and insert them into QuestionCategory if missing.
    if (mongoose.connection.readyState === 1 && questions && Array.isArray(questions)) {
      const QuestionCategory = require('../models/QuestionCategory');
      const uniqueSections = Array.from(new Set(
        questions.map(q => (q.section || '').trim()).filter(Boolean)
      ));
      
      for (const secName of uniqueSections) {
        // Find existing category (case insensitive)
        const existing = await QuestionCategory.findOne({ name: { $regex: new RegExp(`^${secName}$`, 'i') } });
        if (!existing) {
          await QuestionCategory.create({ name: secName, description: 'Auto-created from quiz import' });
        }
      }
    }

    if (mongoose.connection.readyState !== 1 || courseId.startsWith('demo')) {
      const newQuiz = {
        _id: 'demo_quiz_' + Date.now(),
        courseId,
        title,
        questions: questions.map((q, i) => ({ ...q, _id: 'q_' + i })),
        timeLimitSeconds,
        passingScore,
        instructions: instructions || "",
        questionsPerStudent: questionsPerStudent || null,
        shuffleQuestions: shuffleQuestions || false,
        shuffleOptions: shuffleOptions || false,
        sectionDistribution: sectionDistribution || [],
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
      instructions: instructions || "",
      questionsPerStudent: questionsPerStudent || null,
      shuffleQuestions: shuffleQuestions || false,
      shuffleOptions: shuffleOptions || false,
      sectionDistribution: sectionDistribution || [],
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
// @desc    Fetch a single quiz by ID — generates/restores frozen attempt paper for students
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
          instructions: demoQuiz.instructions || "",
          startTime: Date.now()
        });
      }
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // === ASSIGNMENT CHECK (real DB only) ===
    let assignment = null;
    if (mongoose.Types.ObjectId.isValid(quizId) && req.user.role === 'student') {
      assignment = await Assignment.findOne({ userId, quizId });

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
        const graceTime = 60 * 1000; // 1 minute grace for scheduling
        if (now.getTime() + graceTime < new Date(batchAssigned.startTime).getTime()) {
          return res.status(403).json({ success: false, message: 'This quiz is scheduled for a future time' });
        }
        if (now.getTime() - graceTime > new Date(batchAssigned.endTime).getTime()) {
          return res.status(403).json({ success: false, message: 'The schedule for this quiz has expired' });
        }

        // AUTO-CREATE ASSIGNMENT RECORD TO TRACK START TIME
        assignment = await Assignment.findOneAndUpdate(
          { userId, quizId },
          { 
            $setOnInsert: { assignedAt: batchAssigned.createdAt },
            $set: { 
              status: 'IN_PROGRESS', 
              startedAt: new Date()
            } 
          },
          { upsert: true, new: true }
        );

        // Check if already submitted
        const submission = await Submission.findOne({ userId, quizId });
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

    // === GENERATE OR RESTORE FROZEN ATTEMPT PAPER ===
    let questions;
    if (assignment) {
      // Student path: use frozen snapshot (generate if first time, restore on refresh)
      try {
        assignment = await ensureAttemptPaper(assignment, quiz);
        questions = buildQuestionsFromSnapshot(assignment.attemptPaper);
      } catch (paperErr) {
        console.error('[PaperGenerator Error]', paperErr.message);
        return res.status(500).json({ success: false, message: paperErr.message });
      }
    } else {
      // Admin/non-student path: return full master pool (no shuffle)
      questions = quiz.questions.map(q => ({
        _id: q._id,
        question: q.question,
        options: q.options,
        imageUrl: q.imageUrl || ''
      }));
    }

    res.json({
      quizId: quiz._id,
      title: quiz.title,
      duration: quiz.duration,
      questions,
      instructions: quiz.instructions || "",
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

// @route   GET /api/quiz/single/:quizId (Primary route used by AssessmentPage)
// @desc    Fetch quiz for student — generates/restores frozen attempt paper
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
            imageUrl: q.imageUrl || '',
            timeLimitSeconds: demoQuiz.timeLimitSeconds,
          })),
        };
        return res.json({ success: true, quiz: cleanQuiz });
      }
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // === ASSIGNMENT CHECK for students (real DB) ===
    let assignment = null;
    if (mongoose.Types.ObjectId.isValid(quizId) && req.user.role === 'student') {
      assignment = await Assignment.findOne({ userId, quizId });

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
        const graceTime = 60 * 1000; // 1 minute grace for scheduling
        if (now.getTime() + graceTime < new Date(batchAssigned.startTime).getTime()) {
          return res.status(403).json({ success: false, message: 'This quiz is scheduled for a future time' });
        }
        if (now.getTime() - graceTime > new Date(batchAssigned.endTime).getTime()) {
          return res.status(403).json({ success: false, message: 'The schedule for this quiz has expired' });
        }

        // AUTO-CREATE ASSIGNMENT RECORD AND GENERATE PAPER
        assignment = await Assignment.findOneAndUpdate(
          { userId, quizId },
          { 
            $setOnInsert: { assignedAt: batchAssigned.createdAt },
            $set: { 
              status: 'IN_PROGRESS', 
              startedAt: new Date()
            } 
          },
          { upsert: true, new: true }
        );

        // Check if already submitted
        const submission = await Submission.findOne({ userId, quizId });
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

    // === GENERATE OR RESTORE FROZEN ATTEMPT PAPER ===
    let questions;
    let isRandomized = false;

    if (assignment) {
      // Student path: frozen snapshot (generate first time, restore on refresh/reconnect)
      try {
        assignment = await ensureAttemptPaper(assignment, quiz);
        questions = buildQuestionsFromSnapshot(assignment.attemptPaper);
        isRandomized = !!(quiz.questionsPerStudent || quiz.shuffleQuestions || quiz.shuffleOptions);
      } catch (paperErr) {
        console.error('[PaperGenerator Error]', paperErr.message);
        return res.status(500).json({ success: false, message: paperErr.message });
      }
    } else {
      // Admin path: return full master pool, no shuffle
      questions = quiz.questions.map(q => ({
        _id: q._id,
        question: q.question,
        options: q.options,
        imageUrl: q.imageUrl || '',
      }));
    }

    // Build clean quiz object — correctAnswer is NEVER sent to student
    const cleanQuiz = {
      _id: quiz._id,
      title: quiz.title,
      duration: quiz.duration,
      timeLimitSeconds: quiz.duration,
      passingScore: quiz.passingScore,
      instructions: quiz.instructions || "",
      isRandomized,
      questionsDelivered: questions.length,
      totalPoolSize: quiz.questions.length,
      questions,
    };

    res.json({ success: true, quiz: cleanQuiz });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
