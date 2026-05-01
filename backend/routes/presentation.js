const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const Presentation = require('../models/Presentation');
const Poll = require('../models/Poll');

// --- Multer Setup ---
const uploadDir = path.join(__dirname, '../uploads/presentations');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `ppt_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pptx', '.pdf'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only .pptx and .pdf files are allowed'));
    }
  }
});

// Convert PDF or PPTX to slide images
async function convertToSlides(filePath, outputDir) {
  const ext = path.extname(filePath).toLowerCase();
  let pdfPath = filePath;

  // If PPTX, convert to PDF first using LibreOffice
  if (ext === '.pptx') {
    const libreofficeConvert = require('libreoffice-convert');
    const util = require('util');
    const convertAsync = util.promisify(libreofficeConvert.convert);
    const pptxBuf = fs.readFileSync(filePath);
    const pdfBuf = await convertAsync(pptxBuf, '.pdf', undefined);
    pdfPath = filePath.replace('.pptx', '.pdf');
    fs.writeFileSync(pdfPath, pdfBuf);
  }

  // Convert PDF to images using pdf-poppler
  const poppler = require('pdf-poppler');
  const opts = {
    format: 'png',
    out_dir: outputDir,
    out_prefix: 'slide',
    page: null  // all pages
  };
  await poppler.convert(pdfPath, opts);

  // Collect generated files (slide-1.png, slide-2.png, ...)
  const files = fs.readdirSync(outputDir)
    .filter(f => f.startsWith('slide') && f.endsWith('.png'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });

  return files;
}

// @route   POST /api/presentation/upload
// @desc    Upload PPTX or PDF and convert to slide images
// @access  Admin
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });

    const slideId = `slides_${Date.now()}`;
    const slideOutputDir = path.join(__dirname, `../uploads/slides/${slideId}`);
    if (!fs.existsSync(slideOutputDir)) fs.mkdirSync(slideOutputDir, { recursive: true });

    const slideFiles = await convertToSlides(req.file.path, slideOutputDir);

    const slidePaths = slideFiles.map(f => `/uploads/slides/${slideId}/${f}`);

    const presentation = new Presentation({
      title: title.trim(),
      slides: slidePaths,
      slidePolls: []
    });
    await presentation.save();

    res.status(201).json({ success: true, presentation });
  } catch (err) {
    console.error('Presentation upload error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error during conversion' });
  }
});

// @route   GET /api/presentation/all
// @desc    Get all presentations (admin list)
// @access  Admin
router.get('/all', async (req, res) => {
  try {
    const presentations = await Presentation.find().sort({ createdAt: -1 });
    res.json({ success: true, presentations });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/presentation/:id
// @desc    Get a single presentation with populated polls
// @access  Admin
router.get('/:id', async (req, res) => {
  try {
    const presentation = await Presentation.findById(req.params.id).populate('slidePolls.pollId');
    if (!presentation) return res.status(404).json({ success: false, message: 'Presentation not found' });
    res.json({ success: true, presentation });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/presentation/:id/attach-poll
// @desc    Link a poll to a specific slide index
// @access  Admin
router.post('/:id/attach-poll', async (req, res) => {
  try {
    const { slideIndex, pollId } = req.body;
    if (slideIndex === undefined || !pollId) {
      return res.status(400).json({ success: false, message: 'slideIndex and pollId are required' });
    }
    const presentation = await Presentation.findById(req.params.id);
    if (!presentation) return res.status(404).json({ success: false, message: 'Presentation not found' });

    // Remove existing link for this slide if any
    presentation.slidePolls = presentation.slidePolls.filter(sp => sp.slideIndex !== slideIndex);
    presentation.slidePolls.push({ slideIndex, pollId });
    await presentation.save();
    await presentation.populate('slidePolls.pollId');

    res.json({ success: true, presentation });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/presentation/:id/detach-poll/:slideIndex
// @desc    Remove poll from a slide
// @access  Admin
router.delete('/:id/detach-poll/:slideIndex', async (req, res) => {
  try {
    const presentation = await Presentation.findById(req.params.id);
    if (!presentation) return res.status(404).json({ success: false, message: 'Presentation not found' });
    presentation.slidePolls = presentation.slidePolls.filter(sp => sp.slideIndex !== parseInt(req.params.slideIndex));
    await presentation.save();
    res.json({ success: true, presentation });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
