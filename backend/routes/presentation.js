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
  filename: (req, file, cb) => cb(null, `ppt_${Date.now()}_${Math.random().toString(36).slice(2,6)}${path.extname(file.originalname)}`)
});

// Multer for PPT/PDF uploads (server-side conversion)
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pptx', '.ppt', '.pdf'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only .pptx, .ppt and .pdf files are allowed'));
    }
  }
});

// Multer for raw PPTX uploads (no conversion – iframe rendering)
const uploadPptx = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '../uploads/pptx');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `pptx_${Date.now()}_${Math.random().toString(36).slice(2,6)}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pptx', '.ppt'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only .pptx and .ppt files are allowed'));
  }
});

// Multer for slide image uploads (client-side conversion)
const uploadImages = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per file
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Helper to check if a command exists
function commandExists(command) {
  try {
    execSync(`${command} --version`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

// Convert PDF or PPTX to slide images
async function convertToSlides(filePath, outputDir) {
  const ext = path.extname(filePath).toLowerCase();
  let pdfPath = filePath;

  // 1. If PPTX, convert to PDF first using LibreOffice
  if (ext === '.pptx') {
    if (!commandExists('soffice') && !commandExists('libreoffice')) {
      throw new Error('PPTX conversion requires LibreOffice to be installed on the server. Please upload a PDF instead, or contact support to enable PPTX support.');
    }

    try {
      const libreofficeConvert = require('libreoffice-convert');
      const util = require('util');
      const convertAsync = util.promisify(libreofficeConvert.convert);
      const pptxBuf = fs.readFileSync(filePath);
      const pdfBuf = await convertAsync(pptxBuf, '.pdf', undefined);
      pdfPath = filePath.replace('.pptx', '.pdf');
      fs.writeFileSync(pdfPath, pdfBuf);
    } catch (err) {
      console.error('LibreOffice conversion failed:', err);
      throw new Error('Failed to convert PPTX to PDF. The server might be missing LibreOffice dependencies.');
    }
  }

  // 2. Convert PDF to images using pdfjs-dist (Pure JS + Canvas)
  // This is much more compatible with Render/Cloud than pdf-poppler
  try {
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    const { createCanvas } = require('canvas');

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const files = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // High quality
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      const filename = `slide-${i}.png`;
      const outPath = path.join(outputDir, filename);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(outPath, buffer);
      files.push(filename);
    }

    // Clean up temporary PDF if it was converted from PPTX
    if (ext === '.pptx' && fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    return files.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });
  } catch (err) {
    console.error('PDF to Image conversion failed:', err);
    throw new Error('Failed to extract slides from PDF. ' + err.message);
  }
}

// @route   POST /api/presentation/upload-pptx
// @desc    Upload raw PPTX/PPT file. Tries LibreOffice conversion; falls back to saving the raw file for iframe rendering.
// @access  Admin
router.post('/upload-pptx', uploadPptx.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });

    const pptxRelativePath = `/uploads/pptx/${req.file.filename}`;

    // Try converting via LibreOffice (Windows common paths)
    const windowsLibreOfficePaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      'soffice',
      'libreoffice'
    ];

    let conversionSucceeded = false;
    let slidePaths = [];

    for (const soffice of windowsLibreOfficePaths) {
      try {
        const quoted = soffice.includes(' ') ? `"${soffice}"` : soffice;
        const slideId = `slides_${Date.now()}`;
        const slideOutputDir = path.join(__dirname, `../uploads/slides/${slideId}`);
        if (!fs.existsSync(slideOutputDir)) fs.mkdirSync(slideOutputDir, { recursive: true });

        execSync(`${quoted} --headless --convert-to pdf --outdir "${slideOutputDir}" "${req.file.path}"`, { timeout: 120000 });

        // Find the generated PDF
        const files = fs.readdirSync(slideOutputDir);
        const pdfFile = files.find(f => f.endsWith('.pdf'));
        if (!pdfFile) continue;

        // Convert PDF to slides using pdfjs
        const pdfPath = path.join(slideOutputDir, pdfFile);
        const slideFiles = await convertToSlides(pdfPath, slideOutputDir);
        slidePaths = slideFiles.map(f => `/uploads/slides/${slideId}/${f}`);
        conversionSucceeded = true;
        break;
      } catch (e) {
        // Try next path
      }
    }

    const presentation = new Presentation({
      title: title.trim(),
      slides: slidePaths,
      pptxFile: conversionSucceeded ? null : pptxRelativePath,
      slidePolls: []
    });
    await presentation.save();

    res.status(201).json({
      success: true,
      presentation,
      converted: conversionSucceeded,
      message: conversionSucceeded
        ? 'PPTX converted to slides successfully!'
        : 'PPTX saved. It will be displayed using the Office viewer in presentation mode.'
    });
  } catch (err) {
    console.error('PPTX upload error:', err);
    res.status(500).json({ success: false, message: err.message || 'Upload failed' });
  }
});

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
    console.error('Presentation upload error details:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Server error during conversion',
      debug: err.stack 
    });
  }
});

// @route   POST /api/presentation/upload-images
// @desc    Create presentation from already converted images (sent from frontend)
// @access  Admin
router.post('/upload-images', uploadImages.array('slides', 100), async (req, res) => {
  try {
    const { title } = req.body;
    if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: 'No images uploaded' });
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });

    const slideId = `slides_${Date.now()}`;
    const slideOutputDir = path.join(__dirname, `../uploads/slides/${slideId}`);
    if (!fs.existsSync(slideOutputDir)) fs.mkdirSync(slideOutputDir, { recursive: true });

    const slidePaths = [];
    req.files.forEach((file, index) => {
      const ext = path.extname(file.originalname);
      const filename = `slide-${index + 1}${ext}`;
      const newPath = path.join(slideOutputDir, filename);
      fs.renameSync(file.path, newPath);
      slidePaths.push(`/uploads/slides/${slideId}/${filename}`);
    });

    const presentation = new Presentation({
      title: title.trim(),
      slides: slidePaths,
      slidePolls: []
    });
    await presentation.save();

    res.status(201).json({ success: true, presentation });
  } catch (err) {
    console.error('Direct image upload error:', err);
    res.status(500).json({ success: false, message: 'Failed to save presentation images' });
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
