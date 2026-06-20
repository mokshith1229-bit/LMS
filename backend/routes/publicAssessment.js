const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const ExcelJS = require('exceljs');

const PublicAssessment = require('../models/PublicAssessment');
const PublicSubmission = require('../models/PublicSubmission');
const Quiz = require('../models/Quiz');
const { protect } = require('../middleware/auth');

// Cloudinary config (same as existing)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage() });

// ─── Helper: upload buffer to cloudinary ──────────────────────────────────────
const uploadToCloudinary = (buffer, folder = 'public_banners') =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

// ─── Helper: Score submission ──────────────────────────────────────────────────
function scoreSubmission(questions, answers) {
  let correct = 0;
  let wrong = 0;

  const formattedAnswers = questions.map((q, index) => {
    const userAnswer =
      answers && answers[index] !== undefined && answers[index] !== null
        ? answers[index]
        : null;

    if (userAnswer === null || userAnswer === '') {
      return { questionId: q._id.toString(), selectedOption: null };
    }

    const userIdx = userAnswer.toString().trim();
    const correctIdx = q.correctAnswer.toString().trim();

    if (userIdx === correctIdx) correct++;
    else wrong++;

    return { questionId: q._id.toString(), selectedOption: userAnswer.toString() };
  });

  const total = questions.length;
  const unattempted = total - (correct + wrong);
  const percentage = total > 0 ? Number(((correct / total) * 100).toFixed(2)) : 0;

  return { formattedAnswers, correct, wrong, unattempted, percentage, total };
}

// ─── Helper: Check assessment access ──────────────────────────────────────────
function checkAccess(assessment) {
  if (!assessment) return { ok: false, message: 'Assessment not found' };
  if (!assessment.isActive) return { ok: false, message: 'This assessment is not currently active' };

  const now = new Date();
  if (assessment.startDate && now < new Date(assessment.startDate)) {
    return { ok: false, message: 'This assessment has not started yet' };
  }
  if (assessment.endDate && now > new Date(assessment.endDate)) {
    return { ok: false, message: 'This assessment has expired' };
  }
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════════════════════
//  ADMIN ROUTES (require protect middleware)
// ══════════════════════════════════════════════════════════════════════════════

// @route   POST /api/public/
// @desc    Create a new public assessment
// @access  Admin
router.post('/', protect, upload.single('bannerImage'), async (req, res) => {
  try {
    const body = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body;

    const {
      title,
      description,
      backgroundTheme,
      solidColor,
      gradientFrom,
      gradientTo,
      candidateFields,
      questions,
      sourceQuizId,
      duration,
      passingScore,
      showScore,
      isActive,
      startDate,
      endDate,
      slug,
    } = body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (!questions || questions.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one question is required' });
    }

    let finalSlug = slug ? slug.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-') : title.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-');
    // Ensure uniqueness
    const existing = await PublicAssessment.findOne({ slug: finalSlug });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Custom URL slug is already taken. Please choose another one.' });
    }

    let bannerImage = '';
    if (req.file) {
      bannerImage = await uploadToCloudinary(req.file.buffer);
    }

    // If sourceQuizId provided, fetch questions from existing quiz
    let finalQuestions = questions;
    if (sourceQuizId && (!questions || questions.length === 0)) {
      const quiz = await Quiz.findById(sourceQuizId);
      if (!quiz) {
        return res.status(404).json({ success: false, message: 'Source quiz not found' });
      }
      finalQuestions = quiz.questions.map(q => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        imageUrl: q.imageUrl || '',
        section: q.section || '',
      }));
    }

    const assessment = await PublicAssessment.create({
      title,
      description: description || '',
      bannerImage,
      backgroundTheme: backgroundTheme || 'gradient',
      solidColor: solidColor || '#4f46e5',
      gradientFrom: gradientFrom || '#4f46e5',
      gradientTo: gradientTo || '#7c3aed',
      candidateFields: candidateFields || undefined,
      questions: finalQuestions,
      sourceQuizId: sourceQuizId || null,
      duration: duration || 1800,
      passingScore: passingScore || 60,
      showScore: showScore !== undefined ? showScore : true,
      isActive: isActive !== undefined ? isActive : true,
      startDate: startDate || null,
      endDate: endDate || null,
      createdBy: req.user._id,
      slug: finalSlug,
    });

    res.status(201).json({ success: true, assessment });
  } catch (err) {
    console.error('[PublicAssessment Create]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/public/
// @desc    List all public assessments (admin)
// @access  Admin
router.get('/', protect, async (req, res) => {
  try {
    const assessments = await PublicAssessment.find({})
      .select('-questions')
      .sort({ createdAt: -1 });

    // Attach submission counts
    const withCounts = await Promise.all(
      assessments.map(async (a) => {
        const count = await PublicSubmission.countDocuments({ publicAssessmentId: a._id });
        return { ...a.toObject(), submissionCount: count };
      })
    );

    res.json({ success: true, assessments: withCounts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/public/admin/:id
// @desc    Get a single public assessment (admin, includes questions + correct answers)
// @access  Admin
router.get('/admin/:id', protect, async (req, res) => {
  try {
    const assessment = await PublicAssessment.findById(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }
    res.json({ success: true, assessment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/public/admin/:id
// @desc    Update a public assessment
// @access  Admin
router.put('/admin/:id', protect, upload.single('bannerImage'), async (req, res) => {
  try {
    const body = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body;

    const assessment = await PublicAssessment.findById(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    // Upload new banner if provided
    if (req.file) {
      body.bannerImage = await uploadToCloudinary(req.file.buffer);
    }

    // Remove fields that shouldn't be directly set
    delete body._id;
    delete body.token;
    delete body.createdBy;

    if (body.slug) {
      body.slug = body.slug.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-');
      const existing = await PublicAssessment.findOne({ slug: body.slug, _id: { $ne: assessment._id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Custom URL slug is already taken.' });
      }
    }

    Object.assign(assessment, body);
    await assessment.save();

    res.json({ success: true, assessment });
  } catch (err) {
    console.error('[PublicAssessment Update]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   DELETE /api/public/admin/:id
// @desc    Delete a public assessment and all its submissions
// @access  Admin
router.delete('/admin/:id', protect, async (req, res) => {
  try {
    const assessment = await PublicAssessment.findByIdAndDelete(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }
    await PublicSubmission.deleteMany({ publicAssessmentId: req.params.id });
    res.json({ success: true, message: 'Assessment and all submissions deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/public/admin/:id/results
// @desc    Get all submissions for a public assessment
// @access  Admin
router.get('/admin/:id/results', protect, async (req, res) => {
  try {
    const { search, date } = req.query;

    const filter = { publicAssessmentId: req.params.id };

    if (search) {
      filter.$or = [
        { 'candidateData.fullName': { $regex: search, $options: 'i' } },
        { 'candidateData.mobile': { $regex: search, $options: 'i' } },
      ];
    }

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.submittedAt = { $gte: start, $lte: end };
    }

    const submissions = await PublicSubmission.find(filter)
      .sort({ submittedAt: -1 })
      .lean();

    res.json({ success: true, submissions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/public/admin/:id/results/export
// @desc    Export all submissions as Excel
// @access  Admin
router.get('/admin/:id/results/export', protect, async (req, res) => {
  try {
    const assessment = await PublicAssessment.findById(req.params.id).select('title');
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    const submissions = await PublicSubmission.find({ publicAssessmentId: req.params.id })
      .sort({ submittedAt: -1 })
      .lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Results');

    sheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Mobile', key: 'mobile', width: 18 },
      { header: 'Flat No', key: 'flatNo', width: 15 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Employee ID', key: 'employeeId', width: 18 },
      { header: 'Organization', key: 'organization', width: 22 },
      { header: 'City', key: 'city', width: 15 },
      { header: 'Correct', key: 'correct', width: 10 },
      { header: 'Wrong', key: 'wrong', width: 10 },
      { header: 'Unattempted', key: 'unattempted', width: 14 },
      { header: 'Score', key: 'score', width: 10 },
      { header: 'Percentage', key: 'percentage', width: 13 },
      { header: 'Result', key: 'result', width: 12 },
      { header: 'Submitted At', key: 'submittedAt', width: 22 },
    ];

    // Header row style
    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      cell.alignment = { horizontal: 'center' };
    });

    submissions.forEach(s => {
      sheet.addRow({
        name: s.candidateData?.fullName || '',
        mobile: s.candidateData?.mobile || '',
        flatNo: s.candidateData?.flatNo || '',
        email: s.candidateData?.email || '',
        employeeId: s.candidateData?.employeeId || '',
        organization: s.candidateData?.organization || '',
        city: s.candidateData?.city || '',
        correct: s.correct,
        wrong: s.wrong,
        unattempted: s.unattempted,
        score: s.score,
        percentage: `${s.percentage}%`,
        result: s.passed ? 'PASS' : 'FAIL',
        submittedAt: new Date(s.submittedAt).toLocaleString('en-IN'),
      });
    });

    // Zebra striping
    sheet.eachRow((row, rowNum) => {
      if (rowNum > 1 && rowNum % 2 === 0) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
        });
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${assessment.title.replace(/[^a-z0-9]/gi, '_')}_Results.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[Excel Export]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/public/admin/quizzes
// @desc    Get list of existing quizzes for selection during creation
// @access  Admin
router.get('/admin-quizzes/list', protect, async (req, res) => {
  try {
    const quizzes = await Quiz.find({}).select('title questions duration createdAt').sort({ createdAt: -1 });
    res.json({ success: true, quizzes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/public/admin/quizzes/:quizId/questions
// @desc    Get questions from an existing quiz (for preview/import)
// @access  Admin
router.get('/admin-quizzes/:quizId/questions', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId).select('title questions duration passingScore');
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }
    res.json({ success: true, quiz });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/public/admin/stats
// @desc    Get overall stats for dashboard
// @access  Admin
router.get('/admin-stats', protect, async (req, res) => {
  try {
    const totalAssessments = await PublicAssessment.countDocuments();
    const activeAssessments = await PublicAssessment.countDocuments({ isActive: true });
    const totalSubmissions = await PublicSubmission.countDocuments();

    const recentSubmissions = await PublicSubmission.find({})
      .sort({ submittedAt: -1 })
      .limit(5)
      .populate('publicAssessmentId', 'title')
      .lean();

    res.json({
      success: true,
      stats: { totalAssessments, activeAssessments, totalSubmissions },
      recentSubmissions,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  PUBLIC ROUTES (no authentication required)
// ══════════════════════════════════════════════════════════════════════════════

// @route   GET /api/public/p/:token
// @desc    Get public assessment landing data (NO auth) — strips correct answers
// @access  Public
router.get('/p/:token', async (req, res) => {
  try {
    const param = req.params.token;
    const assessment = await PublicAssessment.findOne({
      $or: [
        { token: param.toUpperCase() },
        { slug: param.toLowerCase() }
      ]
    });

    const access = checkAccess(assessment);
    if (!access.ok) {
      return res.status(403).json({ success: false, message: access.message });
    }

    // Strip correct answers before sending to public
    const safeQuestions = assessment.questions.map(q => ({
      _id: q._id,
      question: q.question,
      options: q.options,
      imageUrl: q.imageUrl || '',
    }));

    // Only send enabled candidate fields
    const enabledFields = assessment.candidateFields.filter(f => f.enabled);

    res.json({
      success: true,
      assessment: {
        title: assessment.title,
        slug: assessment.slug,
        description: assessment.description,
        bannerImage: assessment.bannerImage,
        backgroundTheme: assessment.backgroundTheme,
        solidColor: assessment.solidColor,
        gradientFrom: assessment.gradientFrom,
        gradientTo: assessment.gradientTo,
        duration: assessment.duration,
        showScore: assessment.showScore,
        totalQuestions: safeQuestions.length,
        candidateFields: enabledFields,
        questions: safeQuestions,
      },
    });
  } catch (err) {
    console.error('[Public GET]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/public/p/:token/submit
// @desc    Submit candidate answers (NO auth)
// @access  Public
router.post('/p/:token/submit', async (req, res) => {
  try {
    const { candidateData, answers, timeTaken } = req.body;
    const param = req.params.token;

    const assessment = await PublicAssessment.findOne({
      $or: [
        { token: param.toUpperCase() },
        { slug: param.toLowerCase() }
      ]
    });

    const access = checkAccess(assessment);
    if (!access.ok) {
      return res.status(403).json({ success: false, message: access.message });
    }

    // Validate required candidate fields
    const requiredFields = assessment.candidateFields.filter(f => f.enabled && f.required);
    for (const field of requiredFields) {
      if (!candidateData[field.fieldName] || !candidateData[field.fieldName].toString().trim()) {
        return res.status(400).json({
          success: false,
          message: `${field.label} is required`,
        });
      }
    }

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'Answers are required' });
    }

    // Score the submission
    const result = scoreSubmission(assessment.questions, answers);
    const passed = result.percentage >= (assessment.passingScore || 60);

    const submission = await PublicSubmission.create({
      publicAssessmentId: assessment._id,
      candidateData: {
        fullName: candidateData.fullName || '',
        mobile: candidateData.mobile || '',
        flatNo: candidateData.flatNo || '',
        email: candidateData.email || '',
        employeeId: candidateData.employeeId || '',
        organization: candidateData.organization || '',
        city: candidateData.city || '',
        customField: candidateData.customField || '',
      },
      answers: result.formattedAnswers,
      correct: result.correct,
      wrong: result.wrong,
      unattempted: result.unattempted,
      score: result.correct,
      percentage: result.percentage,
      passed,
      timeTaken: timeTaken || 0,
    });

    res.status(201).json({
      success: true,
      result: {
        _id: submission._id,
        correct: result.correct,
        wrong: result.wrong,
        unattempted: result.unattempted,
        total: result.total,
        score: result.correct,
        percentage: result.percentage,
        passed,
        showScore: assessment.showScore,
      },
    });
  } catch (err) {
    console.error('[Public Submit]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
