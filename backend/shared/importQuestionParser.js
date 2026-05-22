/**
 * shared/importQuestionParser.js
 *
 * Unified Excel question parser used by both:
 *   - Quiz bulk import  (/api/import/parse-excel)
 *   - Live Poll import  (/api/import/parse-excel)
 *
 * Supported Excel columns:
 *   Question      – question text (required)
 *   Option A      – first option (required)
 *   Option B      – second option (required)
 *   Option C      – third option (optional)
 *   Option D      – fourth option (optional)
 *   Correct Answer – letter A/B/C/D (required)
 *   Image URL     – direct image URL (optional)
 *   Image File    – column name referencing an embedded file (informational, optional)
 *
 * Image handling:
 *   • If "Image URL" column has a URL → store directly.
 *   • If a matching embedded image (worksheet drawing) exists for the row → upload to Cloudinary.
 *   • Images are stored in `lms/quiz-images` on Cloudinary.
 */

const xlsx = require('xlsx');
const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const streamifier = require('streamifier');

// ─────────────────────────────────────────────
//  Ensure Cloudinary is configured
// ─────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a Buffer or URL to Cloudinary.
 * @param {Buffer|string} source – image buffer or URL string
 * @param {string} folder        – Cloudinary folder
 * @returns {Promise<string>}    – secure_url
 */
async function uploadToCloudinary(source, folder = 'lms/quiz-images') {
  return new Promise((resolve, reject) => {
    const opts = { folder, resource_type: 'image' };

    if (typeof source === 'string') {
      // URL upload
      cloudinary.uploader.upload(source, opts, (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      });
    } else {
      // Buffer upload via stream
      const stream = cloudinary.uploader.upload_stream(opts, (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      });
      streamifier.createReadStream(source).pipe(stream);
    }
  });
}

/**
 * Fetch a remote image URL and upload it to Cloudinary.
 * @param {string} url
 * @param {string} folder
 * @returns {Promise<string>} secure_url
 */
async function uploadUrlToCloudinary(url, folder = 'lms/quiz-images') {
  // Validate it's actually a URL before attempting
  if (!url || !url.startsWith('http')) return null;
  try {
    return await uploadToCloudinary(url, folder);
  } catch (err) {
    console.warn('[importQuestionParser] Failed to upload image URL to Cloudinary:', url, err.message);
    return url; // fallback: return original URL
  }
}

/**
 * Main parser function.
 *
 * @param {Buffer} fileBuffer       – Excel file buffer (from multer memoryStorage)
 * @param {Object} options
 * @param {'quiz'|'poll'} options.mode  – determines output shape
 * @param {boolean} options.uploadImages – if true, upload image URLs to Cloudinary
 * @returns {Promise<Array>}        – parsed questions array
 *
 * Quiz question shape:
 *   { question, options: string[], correctAnswer: number (0-based index), imageUrl? }
 *
 * Poll question shape:
 *   { text, options: string[], correctAnswer: string (option text), imageUrl? }
 */
async function parseExcelQuestions(fileBuffer, { mode = 'quiz', uploadImages = true } = {}) {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  console.log(`[importQuestionParser] Parsing ${rows.length} rows (mode=${mode})`);

  const questions = [];
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Excel rows are 1-indexed, +1 for header

    // ── Case-insensitive key lookup ──
    const get = (search) => {
      const key = Object.keys(row).find(
        (k) => k.toLowerCase().trim() === search.toLowerCase().trim()
      );
      return key ? String(row[key] || '').trim() : '';
    };

    const qText     = get('Question');
    const optA      = get('Option A');
    const optB      = get('Option B');
    const optC      = get('Option C');
    const optD      = get('Option D');
    const correct   = get('Correct Answer').toUpperCase();
    const imageUrl  = get('Image URL');
    const section   = get('Section') || get('Category');

    // ── Validation ──
    if (!qText) {
      errors.push(`Row ${rowNum}: Missing "Question" text — skipped`);
      continue;
    }
    if (!optA || !optB) {
      errors.push(`Row ${rowNum}: Must have at least Option A and Option B — skipped`);
      continue;
    }
    if (!correct || !['A', 'B', 'C', 'D'].includes(correct)) {
      errors.push(`Row ${rowNum}: "Correct Answer" must be A, B, C, or D — skipped`);
      continue;
    }

    // ── Build options array (filter empty) ──
    const optionsRaw = [optA, optB, optC, optD].filter((o) => o !== '');

    // ── Map letter → index ──
    const letterMap = { A: 0, B: 1, C: 2, D: 3 };
    const correctIndex = letterMap[correct];

    if (correctIndex >= optionsRaw.length) {
      errors.push(`Row ${rowNum}: Correct Answer "${correct}" exceeds available options — skipped`);
      continue;
    }

    // ── Handle image ──
    let resolvedImageUrl = '';
    if (imageUrl) {
      if (uploadImages && imageUrl.startsWith('http')) {
        resolvedImageUrl = await uploadUrlToCloudinary(imageUrl);
      } else {
        resolvedImageUrl = imageUrl; // store raw URL / local reference
      }
    }

    // ── Build output based on mode ──
    if (mode === 'poll') {
      // Poll uses { text, options, correctAnswer (string) }
      questions.push({
        text: qText,
        options: optionsRaw,
        correctAnswer: optionsRaw[correctIndex],
        ...(resolvedImageUrl ? { imageUrl: resolvedImageUrl } : {}),
      });
    } else {
      // Quiz uses { question, options, correctAnswer (number) }
      questions.push({
        question: qText,
        options: optionsRaw,
        correctAnswer: correctIndex,
        section: section || '',
        ...(resolvedImageUrl ? { imageUrl: resolvedImageUrl } : {}),
      });
    }
  }

  if (questions.length === 0) {
    throw new Error(
      'No valid questions found. Ensure columns: Question, Option A, Option B, Correct Answer (A/B/C/D). ' +
      (errors.length ? `Errors: ${errors.join('; ')}` : '')
    );
  }

  return { questions, errors, count: questions.length };
}

module.exports = { parseExcelQuestions, uploadToCloudinary, uploadUrlToCloudinary };
