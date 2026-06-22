const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Batch = require('../models/Batch');
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/role');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

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

    // Upsert assignment (Create if new, Reset if exists)
    // IMPORTANT: Clear attemptPaper so a fresh random paper is generated on next exam start
    const assignment = await Assignment.findOneAndUpdate(
      { userId: user._id, quizId },
      {
        status: 'NOT_STARTED',
        assignedAt: new Date(),
        $unset: { startedAt: 1, submittedAt: 1, attemptPaper: 1 }
      },
      { upsert: true, new: true }
    );

    // Clear existing submission to allow fresh start
    await Submission.deleteOne({ userId: user._id, quizId });

    res.status(201).json({
      success: true,
      message: `Quiz "${quiz.title}" assigned/reassigned to ${user.email}`,
      assignment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/admin/results/batch/:batchId
// @desc    Get results separated by batch
// @access  Admin only
router.get('/results/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ success: false, message: 'Invalid batchId' });
    }

    const submissions = await Submission.find({ batchId })
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
        quizTitle: sub.quizId?.title || 'Unknown',
        courseTitle: sub.quizId?.courseId?.title || '',
        correct: sub.correct,
        wrong: sub.wrong,
        unattempted: sub.unattempted,
        total: sub.correct + sub.wrong + sub.unattempted,
        theoryMarks: sub.theoryMarks || 0,
        percentage: sub.percentage,
        answers: sub.answers,
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
        quizId: sub.quizId?._id ? sub.quizId._id.toString() : '',
        userName: sub.userId?.name || 'Unknown',
        userEmail: sub.userId?.email || '',
        userMobile: sub.userId?.mobile || '',
        quizTitle: sub.quizId?.title || 'Unknown',
        courseTitle: sub.quizId?.courseId?.title || '',
        correct: sub.correct,
        wrong: sub.wrong,
        unattempted: sub.unattempted,
        total: sub.correct + sub.wrong + sub.unattempted,
        theoryMarks: sub.theoryMarks || 0,
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

// @route   DELETE /api/admin/results/:submissionId
// @desc    Delete a student submission and reset their assignment status
// @access  Admin only
router.delete('/results/:submissionId', async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    const { userId, quizId } = submission;

    // Delete the submission
    await Submission.findByIdAndDelete(req.params.submissionId);

    // Reset individual assignment if it exists, so the user can retake it
    if (userId && quizId) {
      await Assignment.findOneAndUpdate(
        { userId, quizId },
        {
          status: 'NOT_STARTED',
          $unset: { startedAt: 1, submittedAt: 1, attemptPaper: 1 }
        }
      );
    }

    res.json({ success: true, message: 'Submission deleted successfully and assignment reset' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/admin/results/theory-marks
// @desc    Update theory marks for submissions
// @access  Admin only
router.put('/results/theory-marks', async (req, res) => {
  try {
    const { marksData } = req.body;
    if (!Array.isArray(marksData)) {
      return res.status(400).json({ success: false, message: 'marksData must be an array' });
    }

    for (const data of marksData) {
      const submission = await Submission.findById(data.submissionId).populate('quizId');
      if (submission && submission.quizId) {
        let tMarks = Number(data.theoryMarks);
        if (isNaN(tMarks) || tMarks < 0) tMarks = 0;
        if (tMarks > 20) tMarks = 20;

        submission.theoryMarks = tMarks;
        
        const objectiveMarks = submission.correct * 2;
        const finalMarks = objectiveMarks + tMarks;
        submission.percentage = finalMarks;
        submission.passed = finalMarks >= (submission.quizId.passingScore || 60);

        await submission.save();
      }
    }
    res.json({ success: true, message: 'Theory marks updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Helper: Map numeric index to letter ──────────────────────────────────────
const getLetter = (index) => {
  if (index === null || index === undefined || index === '') return '';
  return String.fromCharCode(65 + parseInt(index));
};

// ── Helper: Build per-student question rows from frozen snapshot ─────────────
// Returns { questionId→letter } map for this submission.
function buildStudentAnswerMap(sub, attemptPaper) {
  const map = {}; // questionId → { userLetter, correctLetter, shuffledOptions }
  if (attemptPaper && attemptPaper.length > 0) {
    // Randomized quiz: use frozen snapshot
    attemptPaper.forEach(item => {
      const ansObj = sub.answers.find(a => a.questionId === item.questionId);
      const userAns = ansObj ? ansObj.selectedOption : null;
      const userLetter = (userAns !== null && userAns !== undefined && userAns !== '')
        ? getLetter(userAns)
        : 'NA';
      const correctLetter = item.displayedCorrectAnswer || getLetter(item.correctAnswer);
      map[item.questionId] = { userLetter, correctLetter, shuffledOptions: item.shuffledOptions };
    });
  }
  return map;
}

// @route   GET /api/admin/results/export
// @desc    Export results as Excel
// @access  Admin only
router.get('/results/export', async (req, res) => {
  try {
    const { batchId, quizId } = req.query;

    let filter = {};
    if (batchId && mongoose.Types.ObjectId.isValid(batchId)) filter.batchId = batchId;
    if (quizId && mongoose.Types.ObjectId.isValid(quizId)) filter.quizId = quizId;

    const submissions = await Submission.find(filter)
      .populate('userId', 'email name')
      .sort({ submittedAt: -1 })
      .lean();

    if (!quizId) {
       return res.status(400).json({ success: false, message: 'quizId is required for detailed export' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
       return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Load all assignment snapshots for these submissions
    const userIds = submissions.map(s => s.userId?._id).filter(Boolean);
    const assignments = await Assignment.find({ quizId, userId: { $in: userIds } }).lean();
    const assignmentMap = {}; // userId string → attemptPaper
    assignments.forEach(a => { assignmentMap[a.userId.toString()] = a.attemptPaper || []; });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Batch Results');

    // Use master pool for columns (all possible questions)
    const columns = [{ header: 'Student Name', key: 'studentName', width: 25 }];
    quiz.questions.forEach((q, idx) => {
      columns.push({ header: `Q${idx + 1}`, key: `q${idx + 1}`, width: 10 });
    });
    columns.push({ header: 'Score', key: 'score', width: 15 });
    worksheet.columns = columns;

    // Row 2: Correct Answers (from master pool)
    const correctAnswersRow = { studentName: 'Correct Answers' };
    const masterCorrectLetters = [];
    
    quiz.questions.forEach((q, idx) => {
      let correctIdx = parseInt(q.correctAnswer);
      if (isNaN(correctIdx)) {
         correctIdx = q.options.findIndex(opt => 
            opt && q.correctAnswer && String(opt).trim().toUpperCase() === String(q.correctAnswer).trim().toUpperCase()
         );
      }
      const letter = correctIdx !== -1 && !isNaN(correctIdx) ? getLetter(correctIdx) : String(q.correctAnswer || '');
      masterCorrectLetters.push(letter);
      correctAnswersRow[`q${idx + 1}`] = letter;
    });
    correctAnswersRow.score = '';
    const row2 = worksheet.addRow(correctAnswersRow);

    row2.eachCell((cell) => {
      cell.font = { color: { argb: 'FF008000' }, bold: true };
    });

    submissions.forEach(sub => {
      const studentRow = {
        studentName: sub.userId?.name || 'Unknown',
        score: sub.percentage + '%'
      };
      const rowValues = [];
      const attemptPaper = assignmentMap[sub.userId?._id?.toString()] || [];
      const snapshotMap = buildStudentAnswerMap(sub, attemptPaper);

      quiz.questions.forEach((q, idx) => {
        const qId = q._id.toString();
        let userLetter = 'NA';
        let correctLetter = masterCorrectLetters[idx];
        let isCorrect = false;

        if (snapshotMap[qId]) {
          // Randomized: use snapshot data
          userLetter = snapshotMap[qId].userLetter;
          isCorrect = userLetter !== 'NA' && userLetter.trim().toUpperCase() === snapshotMap[qId].correctLetter.trim().toUpperCase();
        } else {
          // Legacy (non-randomized): use raw answer
          const ansObj = sub.answers.find(a => a.questionId === qId);
          const userAns = ansObj ? ansObj.selectedOption : null;
          if (userAns !== null && userAns !== undefined && userAns !== '') {
            let userIdx = parseInt(userAns);
            if (isNaN(userIdx)) {
              userIdx = q.options.findIndex(opt => 
                 opt && String(opt).trim().toUpperCase() === String(userAns).trim().toUpperCase()
              );
            }
            userLetter = userIdx !== -1 && !isNaN(userIdx) ? getLetter(userIdx) : String(userAns);
          }
          isCorrect = userLetter !== 'NA' && userLetter.trim().toUpperCase() === correctLetter.trim().toUpperCase();
        }

        studentRow[`q${idx + 1}`] = userLetter;
        rowValues.push({ 
          text: userLetter, 
          isCorrect
        });
      });

      const addedRow = worksheet.addRow(studentRow);
      rowValues.forEach((val, idx) => {
        if (!val.isCorrect && val.text !== 'NA') {
          const cell = addedRow.getCell(idx + 2);
          cell.font = { color: { argb: 'FFFF0000' } };
        }
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=batch-results.xlsx');
    await workbook.xlsx.write(res);
    res.end();
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

    // Prepare bulk operations to reset/create assignments
    // IMPORTANT: Unset attemptPaper so each student gets a fresh random paper on next start
    const ops = userIds.map(userId => ({
      updateOne: {
        filter: { userId, quizId },
        update: {
          $set: {
            status: 'NOT_STARTED',
            assignedAt: new Date(),
          },
          $unset: {
            startedAt: 1,
            submittedAt: 1,
            attemptPaper: 1,  // clear frozen paper — new random paper generated at exam start
          }
        },
        upsert: true
      }
    }));

    await Assignment.bulkWrite(ops);

    // Clear existing submissions for these users to allow fresh start
    await Submission.deleteMany({ userId: { $in: userIds }, quizId });

    res.status(201).json({
      success: true,
      assignedCount: userIds.length,
      message: `Successfully assigned/reassigned quiz to ${userIds.length} student(s)`,
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
//          Uses frozen attempt paper snapshot when available (randomized quizzes)
//          Falls back to master pool for legacy/non-randomized quizzes
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

    // Load the frozen attempt paper for this student (if it exists)
    const assignment = await Assignment.findOne({ userId: user._id, quizId: quiz._id }).lean();
    const attemptPaper = assignment?.attemptPaper || [];
    const isRandomized = attemptPaper.length > 0;

    let answers;

    if (isRandomized) {
      // ── RANDOMIZED QUIZ: Build answer list from FROZEN SNAPSHOT ──────────────
      // This guarantees the PDF/review shows EXACTLY what the student saw.
      answers = attemptPaper.map((item, idx) => {
        const ansObj = submission.answers.find(a => a.questionId === item.questionId);
        const userAnswer = ansObj ? ansObj.selectedOption : null;

        // correctAnswer is index into shuffledOptions
        const correctIdxInt = parseInt(item.correctAnswer);
        const correctOptionText = item.shuffledOptions[correctIdxInt] || item.correctAnswer;

        const userIdxInt = (userAnswer !== null && userAnswer !== undefined && userAnswer !== '')
          ? parseInt(userAnswer)
          : null;
        
        const isCorrect = userIdxInt !== null && userIdxInt === correctIdxInt;

        return {
          question: item.questionText,
          imageUrl: item.imageUrl || '',
          options: item.shuffledOptions,    // EXACT shuffled options shown to student
          correctAnswer: item.correctAnswer, // index string into shuffledOptions
          correctOptionText,
          userAnswer: userAnswer !== null ? userAnswer : null,
          isCorrect,
          isUnattempted: userAnswer === null || userAnswer === '' || userAnswer === undefined,
          displayedOrder: item.displayedOrder,
          section: item.section || '',
        };
      });
    } else {
      // ── LEGACY / NON-RANDOMIZED: Fall back to master pool ───────────────────
      answers = quiz.questions.map((q) => {
        const userAnswerObj = submission.answers.find(a => a.questionId === q._id.toString());
        const userAnswer = userAnswerObj ? userAnswerObj.selectedOption : null;
        const correctAnswer = q.correctAnswer.toString().trim();
        const isCorrect = userAnswer !== null && userAnswer.toString().trim().toUpperCase() === correctAnswer.toUpperCase();

        return {
          question: q.question,
          imageUrl: q.imageUrl || '',
          options: q.options,
          correctAnswer,
          correctOptionText: q.options[parseInt(correctAnswer)] || correctAnswer,
          userAnswer,
          isCorrect,
          isUnattempted: userAnswer === null,
          section: q.section || '',
        };
      });
    }

    // Calculate individual student's section performance
    const indSectionStats = {};
    const passingScoreVal = quiz.passingScore || 60;

    answers.forEach(ans => {
      const secName = (ans.section || 'General').trim();
      if (!indSectionStats[secName]) {
        indSectionStats[secName] = { correct: 0, total: 0 };
      }
      indSectionStats[secName].total++;
      if (ans.isCorrect) {
        indSectionStats[secName].correct++;
      }
    });

    const sectionPerformance = Object.entries(indSectionStats).map(([section, stats]) => {
      const accuracy = stats.total > 0 ? Number(((stats.correct / stats.total) * 100).toFixed(2)) : 0;
      return {
        section,
        correctCount: stats.correct,
        totalCount: stats.total,
        accuracy,
        isWeak: accuracy < passingScoreVal
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
      isRandomized,
      questionsDelivered: answers.length,
      totalPoolSize: quiz.questions.length,
      passingScore: passingScoreVal,
      sectionPerformance,
      answers,
    });
  } catch (error) {
    console.error('Submission View Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/admin/export/detailed/:quizId
// @desc    Export detailed question-by-question results for selected submissions as Excel
//          Uses frozen attempt paper when available (shows student-specific question ordering)
// @access  Admin only
router.post('/export/detailed/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;
    const { submissionIds } = req.body;

    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({ success: false, message: 'Invalid quizId' });
    }

    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      return res.status(400).json({ success: false, message: 'submissionIds array is required' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const submissions = await Submission.find({
      _id: { $in: submissionIds },
      quizId
    })
      .populate('userId', 'email name')
      .sort({ submittedAt: -1 })
      .lean();

    // Load frozen papers for all relevant users
    const userIds = submissions.map(s => s.userId?._id).filter(Boolean);
    const assignments = await Assignment.find({ quizId, userId: { $in: userIds } }).lean();
    const assignmentMap = {};
    assignments.forEach(a => { assignmentMap[a.userId.toString()] = a.attemptPaper || []; });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Detailed Results');

    // Columns: based on master pool (all possible questions shown in pool order)
    const columns = [{ header: 'Student Name', key: 'studentName', width: 25 }];
    quiz.questions.forEach((q, idx) => {
      columns.push({ header: `Q${idx + 1}`, key: `q${idx + 1}`, width: 10 });
    });
    columns.push({ header: 'Score', key: 'score', width: 15 });
    worksheet.columns = columns;

    // Row 2: Master Pool Correct Answers header
    const correctAnswersRow = { studentName: 'Correct Answers (Pool Order)' };
    const masterCorrectLetters = [];
    quiz.questions.forEach((q, idx) => {
      let correctIdx = parseInt(q.correctAnswer);
      if (isNaN(correctIdx)) {
         correctIdx = q.options.findIndex(opt => 
            opt && q.correctAnswer && String(opt).trim().toUpperCase() === String(q.correctAnswer).trim().toUpperCase()
         );
      }
      const letter = correctIdx !== -1 && !isNaN(correctIdx) ? getLetter(correctIdx) : String(q.correctAnswer || '');
      masterCorrectLetters.push(letter);
      correctAnswersRow[`q${idx + 1}`] = letter;
    });
    correctAnswersRow.score = '';

    const row2 = worksheet.addRow(correctAnswersRow);
    row2.eachCell((cell) => {
      cell.font = { color: { argb: 'FF008000' }, bold: true };
    });

    // Student rows
    submissions.forEach(sub => {
      const studentRow = { studentName: sub.userId?.name || 'Unknown', score: sub.percentage + '%' };
      const rowValues = [];
      const attemptPaper = assignmentMap[sub.userId?._id?.toString()] || [];
      
      // Build a map of questionId → student's answer letter from snapshot
      const snapshotMap = buildStudentAnswerMap(sub, attemptPaper);

      quiz.questions.forEach((q, idx) => {
        const qId = q._id.toString();
        let userLetter = 'NA';
        const correctLetter = masterCorrectLetters[idx];
        let isCorrect = false;

        if (snapshotMap[qId]) {
          // Student had this question in their randomized paper
          userLetter = snapshotMap[qId].userLetter;
          isCorrect = userLetter !== 'NA' && userLetter.trim().toUpperCase() === snapshotMap[qId].correctLetter.trim().toUpperCase();
        } else if (attemptPaper.length === 0) {
          // Legacy non-randomized quiz: find answer directly
          const ansObj = sub.answers.find(a => a.questionId === qId);
          const userAns = ansObj ? ansObj.selectedOption : null;
          if (userAns !== null && userAns !== undefined && userAns !== '') {
            let userIdx = parseInt(userAns);
            if (isNaN(userIdx)) {
              userIdx = q.options.findIndex(opt => 
                 opt && String(opt).trim().toUpperCase() === String(userAns).trim().toUpperCase()
              );
            }
            userLetter = userIdx !== -1 && !isNaN(userIdx) ? getLetter(userIdx) : String(userAns);
          }
          isCorrect = userLetter !== 'NA' && userLetter.trim().toUpperCase() === correctLetter.trim().toUpperCase();
        }
        // If question was not in student's paper (subset delivery), leave as 'NA'

        studentRow[`q${idx + 1}`] = userLetter;
        rowValues.push({ 
          text: userLetter, 
          isCorrect
        });
      });

      const addedRow = worksheet.addRow(studentRow);
      rowValues.forEach((val, idx) => {
        if (!val.isCorrect && val.text !== 'NA') {
          const cell = addedRow.getCell(idx + 2);
          cell.font = { color: { argb: 'FFFF0000' } };
        }
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + 'Detailed_Results.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Detailed Export Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/admin/analytics
// @desc    Get analytics for a specific batch and quiz
//          Aggregates by questionId (works for both randomized and non-randomized)
// @access  Admin only
router.get('/analytics', async (req, res) => {
  try {
    const { batchId, quizId } = req.query;

    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing batchId' });
    }
    if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing quizId' });
    }

    const batch = await Batch.findById(batchId).populate('users', 'name email');
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const batchUserIds = (batch.users || []).map(u => u._id);
    const totalStudents = batchUserIds.length;

    const submissions = await Submission.find({
      userId: { $in: batchUserIds },
      quizId,
    })
      .populate('userId', 'name email')
      .lean();

    const attemptedStudents = submissions.length;
    const pendingStudents = Math.max(0, totalStudents - attemptedStudents);

    let averageScore = 0;
    let highestScore = 0;
    let lowestScore = 0;
    let passCount = 0;
    const studentScores = [];
    const studentTable = [];

    if (attemptedStudents > 0) {
      const percentages = submissions.map(s => s.percentage);
      averageScore = percentages.reduce((a, b) => a + b, 0) / attemptedStudents;
      highestScore = Math.max(...percentages);
      lowestScore = Math.min(...percentages);
      passCount = submissions.filter(s => s.passed).length;
    }

    submissions.forEach(sub => {
      studentScores.push({
        name: sub.userId?.name || 'Unknown',
        score: sub.percentage,
      });
      studentTable.push({
        name: sub.userId?.name || 'Unknown',
        email: sub.userId?.email || '',
        correct: sub.correct,
        wrong: sub.wrong,
        unattempted: sub.unattempted,
        total: sub.correct + sub.wrong + sub.unattempted,
        percentage: sub.percentage,
        passed: sub.passed,
        status: sub.status || 'COMPLETED',
        submittedAt: sub.submittedAt,
      });
    });

    // ── Load frozen papers for ALL submissions to enable questionId-based aggregation ──
    const subUserIds = submissions.map(s => s.userId?._id).filter(Boolean);
    const assignments = await Assignment.find({ quizId, userId: { $in: subUserIds } }).lean();
    const assignmentByUser = {};
    assignments.forEach(a => { assignmentByUser[a.userId.toString()] = a.attemptPaper || []; });

    const passPercentage = attemptedStudents > 0
      ? Number(((passCount / attemptedStudents) * 100).toFixed(2))
      : 0;
    const failPercentage = attemptedStudents > 0
      ? Number((((attemptedStudents - passCount) / attemptedStudents) * 100).toFixed(2))
      : 0;

    // ── Item Analysis: aggregate by questionId across all submissions ──────────
    // This handles randomized quizzes correctly because each submission stores questionId,
    // not position — so the same question is tracked regardless of which position it appeared.
    const questions = quiz.questions.map((q) => {
      // Resolve correct answer letter from master pool
      let correctIdx = parseInt(q.correctAnswer);
      if (isNaN(correctIdx)) {
        correctIdx = q.options.findIndex(opt =>
          opt && q.correctAnswer &&
          String(opt).trim().toUpperCase() === String(q.correctAnswer).trim().toUpperCase()
        );
      }
      const correctLetter = correctIdx !== -1 && !isNaN(correctIdx)
        ? getLetter(correctIdx)
        : String(q.correctAnswer || '');

      let correctCount = 0;
      let seenByCount = 0; // how many students actually received this question
      const optionCounts = {};

      q.options.forEach((opt, idx) => {
        optionCounts[getLetter(idx)] = 0;
      });
      optionCounts['NA'] = 0;

      submissions.forEach(sub => {
        const userId = sub.userId?._id?.toString();
        const attemptPaper = assignmentByUser[userId] || [];

        // Check if this student had this question in their paper
        const paperItem = attemptPaper.length > 0
          ? attemptPaper.find(p => p.questionId === q._id.toString())
          : null;

        if (attemptPaper.length > 0 && !paperItem) {
          // Student had a randomized paper that did NOT include this question
          return;
        }

        seenByCount++;

        // Get student's answer
        const ansObj = sub.answers.find(a => a.questionId === q._id.toString());
        const userAns = ansObj ? ansObj.selectedOption : null;

        let userLetter = 'NA';
        let isCorrect = false;

        if (userAns !== null && userAns !== undefined && userAns !== '') {
          if (paperItem) {
            // Randomized: answer is index into shuffledOptions; map back to master pool option
            const shuffledIdx = parseInt(userAns);
            const selectedOptionText = paperItem.shuffledOptions[shuffledIdx] || '';
            
            // Robust normalization function
            const normalizeText = (text) => {
              if (text === null || text === undefined) return '';
              return String(text).trim().toLowerCase().replace(/[\s\u200b-\u200d\ufeff]+/g, ' ');
            };

            const normSelected = normalizeText(selectedOptionText);

            // Find that text in master options to get the display letter
            let masterIdx = q.options.findIndex(o =>
              normalizeText(o) === normSelected
            );

            // Fallback: if no exact match after normalization, try partial/includes match
            if (masterIdx === -1 && normSelected) {
              masterIdx = q.options.findIndex(o =>
                normalizeText(o).includes(normSelected) || normSelected.includes(normalizeText(o))
              );
            }

            userLetter = masterIdx !== -1 ? getLetter(masterIdx) : getLetter(shuffledIdx);
            isCorrect = userAns.toString().trim() === paperItem.correctAnswer.toString().trim();
          } else {
            // Legacy non-randomized
            let userIdx = parseInt(userAns);
            if (isNaN(userIdx)) {
              userIdx = q.options.findIndex(opt =>
                opt && String(opt).trim().toUpperCase() === String(userAns).trim().toUpperCase()
              );
            }
            userLetter = userIdx !== -1 && !isNaN(userIdx) ? getLetter(userIdx) : String(userAns);
            isCorrect = userLetter.trim().toUpperCase() === correctLetter.trim().toUpperCase() && userLetter !== 'NA';
          }
        }

        if (isCorrect) {
          correctCount++;
        }

        if (optionCounts[userLetter] !== undefined) {
          optionCounts[userLetter]++;
        } else {
          optionCounts[userLetter] = 1;
        }
      });

      // Accuracy denominator: students who actually saw this question
      const denominator = seenByCount > 0 ? seenByCount : 1;
      const accuracy = Number(((correctCount / denominator) * 100).toFixed(2));

      const mostSelected = Object.entries(optionCounts)
        .filter(([k]) => k !== 'NA')
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      return {
        questionId: q._id.toString(),
        question: q.question,
        options: q.options,
        accuracy,
        correctAnswer: correctLetter,
        mostSelected,
        optionCounts,
        seenByCount,    // students who received this question
        totalSubmissions: attemptedStudents,
      };
    });

    // Calculate batch-wide section performance
    const sectionStats = {};
    const passingScoreVal = quiz.passingScore || 60;

    submissions.forEach(sub => {
      const userId = sub.userId?._id?.toString();
      const attemptPaper = assignmentByUser[userId] || [];
      const isRandomized = attemptPaper.length > 0;

      if (isRandomized) {
        attemptPaper.forEach(item => {
          const secName = (item.section || 'General').trim();
          if (!sectionStats[secName]) {
            sectionStats[secName] = { correct: 0, total: 0 };
          }
          
          const ansObj = sub.answers.find(a => a.questionId === item.questionId);
          const userAnswer = ansObj ? ansObj.selectedOption : null;
          const correctIdxInt = parseInt(item.correctAnswer);
          const userIdxInt = (userAnswer !== null && userAnswer !== undefined && userAnswer !== '')
            ? parseInt(userAnswer)
            : null;
          const isCorrect = userIdxInt !== null && userIdxInt === correctIdxInt;

          sectionStats[secName].total++;
          if (isCorrect) {
            sectionStats[secName].correct++;
          }
        });
      } else {
        quiz.questions.forEach(q => {
          const secName = (q.section || 'General').trim();
          if (!sectionStats[secName]) {
            sectionStats[secName] = { correct: 0, total: 0 };
          }

          const userAnswerObj = sub.answers.find(a => a.questionId === q._id.toString());
          const userAnswer = userAnswerObj ? userAnswerObj.selectedOption : null;
          const correctAnswer = q.correctAnswer.toString().trim();
          const isCorrect = userAnswer !== null && userAnswer.toString().trim().toUpperCase() === correctAnswer.toUpperCase();

          sectionStats[secName].total++;
          if (isCorrect) {
            sectionStats[secName].correct++;
          }
        });
      }
    });

    const sectionPerformance = Object.entries(sectionStats).map(([section, stats]) => {
      const accuracy = stats.total > 0 ? Number(((stats.correct / stats.total) * 100).toFixed(2)) : 0;
      return {
        section,
        correctCount: stats.correct,
        totalCount: stats.total,
        accuracy,
        isWeak: accuracy < passingScoreVal
      };
    });

    const analyticsData = {
      totalStudents,
      attemptedStudents,
      pendingStudents,
      completionRate: totalStudents > 0
        ? Number(((attemptedStudents / totalStudents) * 100).toFixed(2))
        : 0,
      averageScore: Number(averageScore.toFixed(2)),
      highestScore,
      lowestScore,
      passCount,
      failCount: attemptedStudents - passCount,
      passPercentage,
      failPercentage,
      questions,
      studentScores,
      studentTable,
      // Randomization info for UI
      isRandomized: !!(quiz.questionsPerStudent || quiz.shuffleQuestions || quiz.shuffleOptions),
      questionsPerStudent: quiz.questionsPerStudent || quiz.questions.length,
      totalPoolSize: quiz.questions.length,
      passingScore: passingScoreVal,
      sectionPerformance,
    };

    res.json({ success: true, data: analyticsData });
  } catch (error) {
    console.error('[Analytics Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/admin/batch-pdf/:quizId
// @desc    Generate consolidated batch PDF report for selected submissions
//          Includes cover page, summary table, per-student Q&A with frozen snapshot
// @access  Admin only
// ─────────────────────────────────────────────────────────────────────────────
router.post('/batch-pdf/:quizId', async (req, res) => {
  // ── Brand Colors ────────────────────────────────────────────────────────────
  const CUBE_GREEN  = '#8DC63F';
  const CUBE_DARK   = '#3D3D3D';
  const CUBE_LIGHT  = '#4F4F4F';
  const PASS_GREEN  = '#2f9e44';
  const FAIL_RED    = '#c92a2a';
  const BORDER_GREY = '#cbd5e1';
  const BG_LIGHT    = '#f8fafc';
  const WHITE       = '#ffffff';

  // Helper: hex colour → PDFKit array [r,g,b]
  const hex = (h) => {
    const c = h.replace('#', '');
    return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
  };

  try {
    const { quizId } = req.params;
    const { submissionIds = [], batchName = 'Batch' } = req.body;

    // ── Input Validation ────────────────────────────────────────────────────
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({ success: false, message: 'Invalid quizId' });
    }
    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      return res.status(400).json({ success: false, message: 'submissionIds array is required' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // ── Fetch Submissions ────────────────────────────────────────────────────
    const submissions = await Submission.find({
      _id: { $in: submissionIds },
      quizId,
    })
      .populate('userId', 'name email')
      .sort({ 'userId.name': 1 })
      .lean();

    // ── Load Frozen Paper Snapshots ──────────────────────────────────────────
    const userIds = submissions.map(s => s.userId?._id).filter(Boolean);
    const assignments = await Assignment.find({ quizId, userId: { $in: userIds } }).lean();
    const assignmentMap = {};
    assignments.forEach(a => { assignmentMap[a.userId.toString()] = a.attemptPaper || []; });

    // ── Batch metadata ───────────────────────────────────────────────────────
    const totalStudents = submissions.length;
    const passCount     = submissions.filter(s => s.passed).length;
    const avgScore      = totalStudents > 0
      ? (submissions.reduce((acc, s) => acc + s.percentage, 0) / totalStudents).toFixed(1)
      : 0;
    const reportDate = new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric'
    });
    const safeTitle = (quiz.title || 'Assessment').replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    const safeBatch = (batchName || 'Batch').replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    const filename  = `${safeTitle}_${safeBatch}_Report.pdf`.replace(/ /g, '_');

    // ── Increase request timeout for large PDFs ───────────────────────────────
    req.socket.setTimeout(180000);

    // ── Set response headers ─────────────────────────────────────────────────
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Connection', 'keep-alive');

    // ── Create PDF Document ──────────────────────────────────────────────────
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      autoFirstPage: false,
      bufferPages: false, // streaming mode
      info: {
        Title: `${quiz.title} — Batch Report`,
        Author: 'Cube Tech LMS',
        Creator: 'Cube Tech Enterprise Assessment Engine',
      },
    });

    doc.pipe(res);

    const PAGE_W  = 595.28;  // A4 points
    const PAGE_H  = 841.89;
    const MARGIN  = 40;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    // ────────────────────────────────────────────────────────────────────────
    // HELPER: add page-number footer and optional header bar
    // ────────────────────────────────────────────────────────────────────────
    let currentPage = 0;
    const addPageWithHeader = (headerLabel = '') => {
      doc.addPage({ size: 'A4', margin: 0 });
      currentPage++;

      // Top bar
      doc.rect(0, 0, PAGE_W, 36)
         .fill(hex(CUBE_DARK));

      doc.fontSize(8).fillColor(hex(WHITE))
         .text('CUBE TECH LMS  •  CONFIDENTIAL', MARGIN, 13, { width: CONTENT_W, align: 'left' });
      doc.fontSize(8).fillColor(hex(WHITE))
         .text(reportDate, MARGIN, 13, { width: CONTENT_W, align: 'right' });

      if (headerLabel) {
        doc.fontSize(7).fillColor(hex(CUBE_GREEN))
           .text(headerLabel.toUpperCase(), MARGIN, 24, { width: CONTENT_W, align: 'left' });
      }

      // Bottom bar
      doc.rect(0, PAGE_H - 28, PAGE_W, 28).fill(hex(BG_LIGHT));
      doc.fontSize(7).fillColor(hex(CUBE_LIGHT))
         .text(`${quiz.title}  |  Page ${currentPage}`, MARGIN, PAGE_H - 18, { width: CONTENT_W, align: 'center' });

      return 50; // return Y cursor after header
    };

    // ────────────────────────────────────────────────────────────────────────
    // PAGE 1: COVER PAGE
    // ────────────────────────────────────────────────────────────────────────
    doc.addPage({ size: 'A4', margin: 0 });
    currentPage++;

    // Full dark background
    doc.rect(0, 0, PAGE_W, PAGE_H).fill(hex(CUBE_DARK));

    // Green accent strip (left)
    doc.rect(0, 0, 8, PAGE_H).fill(hex(CUBE_GREEN));

    // OFFICIAL ASSESSMENT RECORD label
    doc.fontSize(9).fillColor(hex(CUBE_GREEN))
       .text('OFFICIAL ASSESSMENT RECORD', MARGIN + 8, 100, { align: 'center', width: CONTENT_W });

    // Thin line under label
    const lineY = 118;
    doc.moveTo(MARGIN + 8, lineY).lineTo(PAGE_W - MARGIN - 8, lineY)
       .strokeColor(hex(CUBE_GREEN)).lineWidth(0.5).stroke();

    // Main title
    doc.fontSize(38).fillColor(hex(WHITE)).font('Helvetica-Bold')
       .text('Batch Report', MARGIN, 140, { align: 'center', width: CONTENT_W });

    // Assessment name
    doc.fontSize(18).fillColor(hex(CUBE_GREEN)).font('Helvetica-Bold')
       .text(quiz.title, MARGIN, 200, { align: 'center', width: CONTENT_W });

    // Divider
    doc.moveTo(MARGIN + 80, 238).lineTo(PAGE_W - MARGIN - 80, 238)
       .strokeColor(hex(CUBE_LIGHT)).lineWidth(0.5).stroke();

    // Stats block
    const statY = 270;
    const statBoxW = CONTENT_W / 3;
    const stats = [
      { label: 'Total Students', value: totalStudents },
      { label: 'Pass Rate', value: `${Math.round((passCount/Math.max(1,totalStudents))*100)}%` },
      { label: 'Average Score', value: `${avgScore}%` },
    ];
    stats.forEach((s, i) => {
      const x = MARGIN + i * statBoxW;
      doc.fontSize(28).fillColor(hex(CUBE_GREEN)).font('Helvetica-Bold')
         .text(String(s.value), x, statY, { width: statBoxW, align: 'center' });
      doc.fontSize(9).fillColor('#94a3b8').font('Helvetica')
         .text(s.label, x, statY + 38, { width: statBoxW, align: 'center' });
    });

    // Info block
    const infoY = 390;
    const infoData = [
      ['Assessment', quiz.title],
      ['Batch', batchName],
      ['Report Date', reportDate],
      ['Total Submissions', String(totalStudents)],
      ['Passed / Failed', `${passCount} / ${totalStudents - passCount}`],
    ];
    infoData.forEach(([label, val], i) => {
      const y = infoY + i * 38;
      doc.rect(MARGIN, y, CONTENT_W, 32).fill(hex('#2a2a2a'));
      doc.fontSize(8).fillColor('#64748b').font('Helvetica')
         .text(label.toUpperCase(), MARGIN + 16, y + 8);
      doc.fontSize(12).fillColor(hex(WHITE)).font('Helvetica-Bold')
         .text(val, MARGIN + 16, y + 18);
    });

    // Footer branding
    doc.fontSize(10).fillColor(hex(CUBE_GREEN)).font('Helvetica-Bold')
       .text('CUBE TECH  •  ENTERPRISE LMS', MARGIN, PAGE_H - 80, { align: 'center', width: CONTENT_W });
    doc.fontSize(8).fillColor('#64748b').font('Helvetica')
       .text('Confidential — For Internal Use Only', MARGIN, PAGE_H - 64, { align: 'center', width: CONTENT_W });

    // ────────────────────────────────────────────────────────────────────────
    // PAGE 2: SUMMARY TABLE
    // ────────────────────────────────────────────────────────────────────────
    let y = addPageWithHeader('Batch Summary');
    y += 10;

    // Section title
    doc.fontSize(16).fillColor(hex(CUBE_DARK)).font('Helvetica-Bold')
       .text('Student Summary', MARGIN, y);
    y += 28;

    // Table header
    const colWidths = [180, 60, 55, 55, 55, 65, 65];
    const colHeaders = ['Student Name', 'Score', 'Correct', 'Wrong', 'Unattempted', 'Result', 'Submitted'];
    let xCur = MARGIN;

    doc.rect(MARGIN, y, CONTENT_W, 22).fill(hex(CUBE_DARK));
    colHeaders.forEach((h, i) => {
      doc.fontSize(8).fillColor(hex(WHITE)).font('Helvetica-Bold')
         .text(h, xCur + 4, y + 7, { width: colWidths[i] - 4, align: i > 0 ? 'center' : 'left' });
      xCur += colWidths[i];
    });
    y += 22;

    submissions.forEach((sub, idx) => {
      // Check page space
      if (y > PAGE_H - 60) {
        y = addPageWithHeader('Batch Summary (continued)');
        y += 10;
      }

      const rowH = 20;
      const rowBg = idx % 2 === 0 ? hex(BG_LIGHT) : hex(WHITE);
      doc.rect(MARGIN, y, CONTENT_W, rowH).fill(rowBg);

      // Border
      doc.rect(MARGIN, y, CONTENT_W, rowH).strokeColor(hex(BORDER_GREY)).lineWidth(0.3).stroke();

      const name = sub.userId?.name || 'Unknown';
      const submittedStr = sub.submittedAt
        ? new Date(sub.submittedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
        : '—';

      const rowValues = [
        { text: name.length > 22 ? name.slice(0,20)+'…' : name, align: 'left' },
        { text: `${sub.percentage}%`, align: 'center' },
        { text: String(sub.correct),  align: 'center' },
        { text: String(sub.wrong),    align: 'center' },
        { text: String(sub.unattempted), align: 'center' },
        { text: sub.passed ? 'PASS' : 'FAIL', align: 'center', color: sub.passed ? PASS_GREEN : FAIL_RED },
        { text: submittedStr, align: 'center' },
      ];

      xCur = MARGIN;
      rowValues.forEach((rv, i) => {
        doc.fontSize(8).fillColor(hex(rv.color || CUBE_DARK)).font('Helvetica')
           .text(rv.text, xCur + 4, y + 6, { width: colWidths[i] - 4, align: rv.align });
        xCur += colWidths[i];
      });
      y += rowH;
    });

    // ────────────────────────────────────────────────────────────────────────
    // STUDENT SECTIONS: one section per student
    // ────────────────────────────────────────────────────────────────────────
    for (const sub of submissions) {
      y = addPageWithHeader(`Student: ${sub.userId?.name || 'Unknown'}`);
      y += 10;

      const studentName = sub.userId?.name || 'Unknown';
      const studentEmail = sub.userId?.email || '';
      const userId = sub.userId?._id?.toString();
      const attemptPaper = assignmentMap[userId] || [];
      const isRandomized = attemptPaper.length > 0;

      // ── Name Banner ──────────────────────────────────────────────────────
      doc.rect(MARGIN, y, CONTENT_W, 40).fill(hex(CUBE_DARK));
      doc.rect(MARGIN, y, 4, 40).fill(hex(CUBE_GREEN));
      doc.fontSize(16).fillColor(hex(WHITE)).font('Helvetica-Bold')
         .text(studentName, MARGIN + 14, y + 8, { width: CONTENT_W - 160 });
      doc.fontSize(9).fillColor('#94a3b8').font('Helvetica')
         .text(studentEmail, MARGIN + 14, y + 26, { width: CONTENT_W - 160 });

      // Score pill (top right of banner)
      const pillX = PAGE_W - MARGIN - 100;
      doc.rect(pillX, y + 5, 90, 30)
         .fill(hex(sub.passed ? PASS_GREEN : FAIL_RED));
      doc.fontSize(18).fillColor(hex(WHITE)).font('Helvetica-Bold')
         .text(`${sub.percentage}%`, pillX, y + 9, { width: 90, align: 'center' });
      y += 50;

      // ── Score Card row ───────────────────────────────────────────────────
      const cardData = [
        { label: 'Correct',  value: String(sub.correct),     color: PASS_GREEN },
        { label: 'Wrong',    value: String(sub.wrong),       color: FAIL_RED   },
        { label: 'Unattempted', value: String(sub.unattempted), color: CUBE_LIGHT },
        { label: 'Result',   value: sub.passed ? 'PASS' : 'FAIL', color: sub.passed ? PASS_GREEN : FAIL_RED },
      ];
      const cardW = CONTENT_W / 4;
      cardData.forEach((c, i) => {
        const cx = MARGIN + i * cardW;
        doc.rect(cx, y, cardW - 4, 46)
           .fill(hex(BG_LIGHT)).strokeColor(hex(BORDER_GREY)).lineWidth(0.5).stroke();
        doc.fontSize(20).fillColor(hex(c.color)).font('Helvetica-Bold')
           .text(c.value, cx, y + 6, { width: cardW - 4, align: 'center' });
        doc.fontSize(8).fillColor(hex(CUBE_LIGHT)).font('Helvetica')
           .text(c.label, cx, y + 30, { width: cardW - 4, align: 'center' });
      });
      y += 56;

      // Submission time
      const subTime = sub.submittedAt
        ? new Date(sub.submittedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        : '—';
      doc.fontSize(8).fillColor(hex(CUBE_LIGHT)).font('Helvetica')
         .text(`Submitted: ${subTime}`, MARGIN, y);
      y += 18;

      // ── Q&A Section ──────────────────────────────────────────────────────
      doc.fontSize(11).fillColor(hex(CUBE_DARK)).font('Helvetica-Bold')
         .text('Question-by-Question Review', MARGIN, y);
      if (isRandomized) {
        doc.fontSize(8).fillColor(hex(CUBE_GREEN)).font('Helvetica')
           .text('  (Student-specific randomized paper)', MARGIN + 170, y + 1);
      }
      y += 20;

      // Thin separator
      doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y)
         .strokeColor(hex(BORDER_GREY)).lineWidth(0.5).stroke();
      y += 8;

      // Build answer list from frozen snapshot or master pool
      let answers = [];
      try {
        if (isRandomized) {
          answers = attemptPaper.map((item) => {
            const ansObj = sub.answers.find(a => a.questionId === item.questionId);
            const userAnswer = ansObj ? ansObj.selectedOption : null;
            const correctIdxInt = parseInt(item.correctAnswer);
            const userIdxInt = (userAnswer !== null && userAnswer !== undefined && userAnswer !== '')
              ? parseInt(userAnswer) : null;
            const isCorrect = userIdxInt !== null && userIdxInt === correctIdxInt;
            return {
              question: item.questionText,
              options: item.shuffledOptions,
              correctAnswer: item.correctAnswer,
              userAnswer,
              isCorrect,
              isUnattempted: userAnswer === null || userAnswer === '' || userAnswer === undefined,
            };
          });
        } else {
          answers = quiz.questions.map((q) => {
            const userAnswerObj = sub.answers.find(a => a.questionId === q._id.toString());
            const userAnswer = userAnswerObj ? userAnswerObj.selectedOption : null;
            const correctAnswer = q.correctAnswer.toString().trim();
            const isCorrect = userAnswer !== null &&
              userAnswer.toString().trim().toUpperCase() === correctAnswer.toUpperCase();
            return {
              question: q.question,
              options: q.options,
              correctAnswer,
              userAnswer,
              isCorrect,
              isUnattempted: userAnswer === null,
            };
          });
        }
      } catch (snapErr) {
        // Corrupted snapshot — emit warning, continue
        doc.fontSize(9).fillColor(hex(FAIL_RED)).font('Helvetica')
           .text('⚠ Unable to load question snapshot for this student.', MARGIN, y);
        y += 20;
        answers = [];
      }

      // Render each question
      for (let qi = 0; qi < answers.length; qi++) {
        const item = answers[qi];
        const correctIdxInt = parseInt(item.correctAnswer);
        const userIdxInt = (item.userAnswer !== null && item.userAnswer !== undefined && item.userAnswer !== '')
          ? parseInt(item.userAnswer) : null;

        // Estimate height needed for this question
        const optionLines = item.options.length;
        const estHeight = 24 + 14 + optionLines * 16 + 10;

        if (y + estHeight > PAGE_H - 40) {
          y = addPageWithHeader(`Student: ${studentName} (continued)`);
          y += 10;
        }

        // Question number + status dot
        const statusColor = item.isUnattempted ? CUBE_LIGHT
          : item.isCorrect ? PASS_GREEN : FAIL_RED;

        doc.circle(MARGIN + 8, y + 8, 7).fill(hex(statusColor));
        doc.fontSize(8).fillColor(hex(WHITE)).font('Helvetica-Bold')
           .text(String(qi + 1), MARGIN + 4, y + 4, { width: 14, align: 'center' });

        // Question text
        doc.fontSize(9).fillColor(hex(CUBE_DARK)).font('Helvetica-Bold')
           .text(item.question, MARGIN + 20, y, { width: CONTENT_W - 20 });
        y += Math.max(14, doc.heightOfString(item.question, { width: CONTENT_W - 20, fontSize: 9 })) + 4;

        // Options
        item.options.forEach((opt, oi) => {
          const letter = String.fromCharCode(65 + oi); // A, B, C, D...
          const isUserChoice = userIdxInt === oi;
          const isCorrectChoice = correctIdxInt === oi;

          const boxX = MARGIN + 22;
          const boxW = CONTENT_W - 22;
          const boxH = 14;
          const boxY = y - 1;

          if (item.isCorrect) {
            // Correct Question: No surrounding box card or border for options, just clean text layout

            if (isCorrectChoice) {
              // Highlight only the text of the correct option in green (keeping the letter prefix neutral)
              doc.fontSize(8)
                 .fillColor(hex(CUBE_DARK))
                 .font('Helvetica')
                 .text(`${letter}.  `, MARGIN + 28, y + 1, { continued: true });
              doc.fontSize(8)
                 .fillColor(hex(PASS_GREEN))
                 .font('Helvetica-Bold')
                 .text(opt);
            } else {
              // Normal plain neutral text
              doc.fontSize(8)
                 .fillColor(hex(CUBE_DARK))
                 .font('Helvetica')
                 .text(`${letter}.  ${opt}`, MARGIN + 28, y + 1, { width: CONTENT_W - 46 });
            }
          }
          else {
            // Incorrect Question: use the full highlighted style for the wrong selection and correct choice
            const shouldHighlight = !item.isUnattempted;

            if (shouldHighlight && isCorrectChoice) {
              // Correct Option: subtle neutral light green fill, 3px solid green left border, fine green outline
              doc.rect(boxX, boxY, boxW, boxH)
                 .fillColor(hex('#f4fbf7')) // premium light green tint
                 .fill();
              
              doc.rect(boxX, boxY, 3, boxH)
                 .fillColor(hex(PASS_GREEN))
                 .fill();

              doc.rect(boxX, boxY, boxW, boxH)
                 .lineWidth(0.5)
                 .strokeColor(hex('#bbf7d0'))
                 .stroke();

              // Vector green tick icon on the right edge
              const indicatorX = PAGE_W - MARGIN - 18;
              doc.lineWidth(1.2)
                 .strokeColor(hex(PASS_GREEN))
                 .moveTo(indicatorX, y + 5)
                 .lineTo(indicatorX + 2.5, y + 7.5)
                 .lineTo(indicatorX + 7, y + 3)
                 .stroke();

              // Bold dark professional charcoal text
              doc.fontSize(8)
                 .fillColor(hex('#1c3d23'))
                 .font('Helvetica-Bold')
                 .text(`${letter}.  ${opt}`, MARGIN + 28, y + 1, { width: CONTENT_W - 46 });
            }
            else if (shouldHighlight && isUserChoice) {
              // Incorrect Selected Option: subtle neutral light red fill, 3px solid red left border, fine red outline
              doc.rect(boxX, boxY, boxW, boxH)
                 .fillColor(hex('#fdf4f4')) // premium light red tint
                 .fill();

              doc.rect(boxX, boxY, 3, boxH)
                 .fillColor(hex(FAIL_RED))
                 .fill();

              doc.rect(boxX, boxY, boxW, boxH)
                 .lineWidth(0.5)
                 .strokeColor(hex('#fca5a5'))
                 .stroke();

              // Vector red cross icon on the right edge
              const indicatorX = PAGE_W - MARGIN - 18;
              doc.lineWidth(1.2)
                 .strokeColor(hex(FAIL_RED))
                 .moveTo(indicatorX + 1, y + 3.5)
                 .lineTo(indicatorX + 6, y + 8.5)
                 .moveTo(indicatorX + 6, y + 3.5)
                 .lineTo(indicatorX + 1, y + 8.5)
                 .stroke();

              // Bold dark professional charcoal text
              doc.fontSize(8)
                 .fillColor(hex('#5c1e1e'))
                 .font('Helvetica-Bold')
                 .text(`${letter}.  ${opt}`, MARGIN + 28, y + 1, { width: CONTENT_W - 46 });
            }
            else {
              // Normal Option: plain neutral text, white background, minimal light border
              doc.rect(boxX, boxY, boxW, boxH)
                 .lineWidth(0.5)
                 .fillColor(hex(WHITE))
                 .strokeColor(hex('#e2e8f0'))
                 .fillAndStroke();

              // Plain neutral text
              doc.fontSize(8)
                 .fillColor(hex(CUBE_DARK))
                 .font('Helvetica')
                 .text(`${letter}.  ${opt}`, MARGIN + 28, y + 1, { width: CONTENT_W - 46 });
            }
          }

          y += 16;
        });

        // Unattempted notice
        if (item.isUnattempted) {
          doc.fontSize(7).fillColor(hex(CUBE_LIGHT)).font('Helvetica')
             .text('Not attempted', MARGIN + 22, y);
          y += 12;
        }

        y += 6; // gap between questions
      }
    }

    // ── Finalize PDF ────────────────────────────────────────────────────────
    doc.end();
  } catch (err) {
    console.error('[Batch PDF Error]', err);
    // Only send error JSON if headers not sent yet
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
});

// @route   GET /api/admin/questions
// @desc    Get all questions from all quizzes for the Question Bank
// @access  Admin only
router.get('/questions', async (req, res) => {
  try {
    const quizzes = await Quiz.find({}).populate('courseId', 'title').lean();
    let allQuestions = [];

    quizzes.forEach(quiz => {
      if (quiz.questions && quiz.questions.length > 0) {
        quiz.questions.forEach(q => {
          allQuestions.push({
            _id: q._id,
            quizId: quiz._id,
            quizTitle: quiz.title,
            courseTitle: quiz.courseId ? quiz.courseId.title : 'No Course',
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            section: q.section || '',
            imageUrl: q.imageUrl || '',
            createdAt: q.createdAt || quiz.createdAt
          });
        });
      }
    });

    res.json({ success: true, count: allQuestions.length, questions: allQuestions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PATCH /api/admin/questions/bulk-category
// @desc    Bulk update category/section for selected questions
// @access  Admin only
router.patch('/questions/bulk-category', async (req, res) => {
  try {
    const { questionIds, category } = req.body;

    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Valid questionIds array is required' });
    }

    // Convert string IDs to ObjectIds if necessary (Mongoose updateMany with arrayFilters often needs correct types)
    const objectIds = questionIds.map(id => {
      try { return new mongoose.Types.ObjectId(id); }
      catch { return id; }
    });

    const result = await Quiz.updateMany(
      { 'questions._id': { $in: objectIds } },
      { $set: { 'questions.$[elem].section': category || '' } },
      { arrayFilters: [{ 'elem._id': { $in: objectIds } }] }
    );

    res.json({
      success: true,
      message: `Successfully updated category to "${category}" for selected questions.`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('[Bulk Category Update Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/admin/questions/:questionId
// @desc    Edit a question's text, options, correctAnswer, section, and imageUrl
// @access  Admin only
router.put('/questions/:questionId', async (req, res) => {
  try {
    const { questionId } = req.params;
    const { question, options, correctAnswer, section, imageUrl } = req.body;

    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({ success: false, message: 'Invalid questionId' });
    }

    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ success: false, message: 'Question text and at least 2 options are required' });
    }

    if (correctAnswer === undefined || correctAnswer === null || correctAnswer === '') {
      return res.status(400).json({ success: false, message: 'Correct answer is required' });
    }

    // Find the quiz containing this question
    const quiz = await Quiz.findOne({ 'questions._id': questionId });
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Question or associated Quiz not found' });
    }

    // Find the specific question subdocument
    const subdoc = quiz.questions.id(questionId);
    if (!subdoc) {
      return res.status(404).json({ success: false, message: 'Question subdocument not found' });
    }

    // Update fields
    subdoc.question = question;
    subdoc.options = options;
    subdoc.correctAnswer = String(correctAnswer);
    subdoc.section = section || '';
    subdoc.imageUrl = imageUrl || '';

    await quiz.save();

    res.json({
      success: true,
      message: 'Question updated successfully',
      question: {
        _id: subdoc._id,
        quizId: quiz._id,
        quizTitle: quiz.title,
        courseTitle: quiz.courseId ? quiz.courseId.title : 'No Course',
        question: subdoc.question,
        options: subdoc.options,
        correctAnswer: subdoc.correctAnswer,
        section: subdoc.section,
        imageUrl: subdoc.imageUrl
      }
    });
  } catch (error) {
    console.error('[Edit Question Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
