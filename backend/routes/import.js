/**
 * routes/import.js
 *
 * Unified Excel import endpoint for both Quiz and Live Poll.
 *
 * POST /api/import/parse-excel
 *   Body (multipart/form-data):
 *     file   – .xlsx / .xls file
 *     mode   – "quiz" | "poll"  (default: "quiz")
 *     uploadImages – "true" | "false" (default: "true")
 *
 * Returns:
 *   { success, questions, count, errors, mode }
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth');
const { parseExcelQuestions } = require('../shared/importQuestionParser');

// Use memory storage so we can pass the buffer directly to the parser
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.match(/\.(xlsx|xls)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .xls files are allowed'));
    }
  },
});

/**
 * POST /api/import/parse-excel
 * Unified Excel question import — used by both Quiz and Live Poll pages.
 */
router.post('/parse-excel', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: 'Please upload an Excel file (.xlsx or .xls)' });
    }

    const mode = (req.body.mode || 'quiz').toLowerCase();
    const uploadImages = req.body.uploadImages !== 'false'; // default true

    if (!['quiz', 'poll'].includes(mode)) {
      return res
        .status(400)
        .json({ success: false, message: 'mode must be "quiz" or "poll"' });
    }

    console.log(
      `[import] Parsing Excel — mode=${mode}, uploadImages=${uploadImages}, rows≈unknown`
    );

    const { questions, errors, count } = await parseExcelQuestions(
      req.file.buffer,
      { mode, uploadImages }
    );

    return res.status(200).json({
      success: true,
      questions,
      count,
      errors,          // non-fatal row-level errors (skipped rows)
      mode,
      message: `${count} question(s) parsed successfully${
        errors.length ? ` (${errors.length} row(s) skipped)` : ''
      }`,
    });
  } catch (err) {
    console.error('[import] parse-excel error:', err.message);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to parse Excel file',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/import/upload-image
//  Upload a single image file (from user's local system) to Cloudinary.
//  Used by AddQuiz per-question image upload.
//
//  Body: multipart/form-data  { image: <file> }
//  Returns: { success, url }  where url = Cloudinary secure_url
// ─────────────────────────────────────────────────────────────────────────────
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per image
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpg, png, webp, gif, etc.)'));
    }
  },
});

router.post('/upload-image', protect, imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file received' });
    }

    console.log(`[import/upload-image] Uploading ${req.file.originalname} (${req.file.size} bytes) to Cloudinary…`);

    const secure_url = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'lms/quiz-images', resource_type: 'image' },
        (err, result) => {
          if (err) reject(err);
          else resolve(result.secure_url);
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    console.log(`[import/upload-image] ✅ Uploaded: ${secure_url}`);
    return res.status(200).json({ success: true, url: secure_url });
  } catch (err) {
    console.error('[import/upload-image] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Image upload failed' });
  }
});

module.exports = router;
