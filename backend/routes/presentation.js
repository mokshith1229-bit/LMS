const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const Presentation = require('../models/Presentation');

// Test route to verify connectivity
router.get('/test-ping', (req, res) => {
  res.json({ success: true, message: 'Presentation router is alive!' });
});

// ─────────────────────────────────────────────
//  Directory Setup
// ─────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../uploads/presentations');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ─────────────────────────────────────────────
//  Multer: PPT / PPTX uploads (for CloudConvert)
// ─────────────────────────────────────────────
const pptStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, `ppt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${path.extname(file.originalname)}`)
});

const uploadPptx = multer({
  storage: pptStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.ppt', '.pptx'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only .ppt and .pptx files are allowed'));
  }
});

// ─────────────────────────────────────────────
//  Multer: Slide image uploads (client-side PDF conversion)
// ─────────────────────────────────────────────
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${path.extname(file.originalname)}`)
});

const uploadImages = multer({
  storage: imageStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per image
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// ─────────────────────────────────────────────
//  CloudConvert: Convert PPT/PPTX → PNG slides
// ─────────────────────────────────────────────
async function convertPPTWithCloudConvert(filePath) {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;

  if (!apiKey || apiKey === 'your_cloudconvert_api_key_here') {
    throw new Error('CLOUDCONVERT_API_KEY is not configured in .env');
  }

  const CC_API = 'https://api.cloudconvert.com/v2';
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  console.log('[CloudConvert] Creating conversion job...');

  // ── Step 1: Create the job with 3 tasks in one request ──
  const { data: jobData } = await axios.post(
    `${CC_API}/jobs`,
    {
      tasks: {
        'import-file': {
          operation: 'import/upload'
        },
        'convert-file': {
          operation: 'convert',
          input: 'import-file',
          output_format: 'png',
          engine: 'office',
          density: 150   // 150 DPI — good quality, lower credit usage than 300
        },
        'export-file': {
          operation: 'export/url',
          input: 'convert-file'
        }
      }
    },
    { headers }
  );

  const job = jobData.data;
  const jobId = job.id;
  const importTask = job.tasks.find(t => t.name === 'import-file');

  if (!importTask?.result?.form) {
    throw new Error('CloudConvert did not return an upload URL');
  }

  // ── Step 2: Upload the PPTX file ──
  console.log('[CloudConvert] Uploading file...');
  const { url: uploadUrl, parameters: uploadParams } = importTask.result.form;

  const form = new FormData();
  // Append all required S3 params first
  for (const [key, value] of Object.entries(uploadParams)) {
    form.append(key, value);
  }
  form.append('file', fs.createReadStream(filePath));

  await axios.post(uploadUrl, form, { headers: form.getHeaders(), maxBodyLength: Infinity });

  // ── Step 3: Poll until job is finished ──
  console.log('[CloudConvert] Waiting for conversion...');
  let finished = false;
  let attempts = 0;
  const MAX_ATTEMPTS = 60; // 60 × 5s = 5 minutes max

  while (!finished && attempts < MAX_ATTEMPTS) {
    await new Promise(r => setTimeout(r, 5000)); // wait 5 seconds
    attempts++;

    const { data: statusData } = await axios.get(`${CC_API}/jobs/${jobId}`, { headers });
    const status = statusData.data.status;

    console.log(`[CloudConvert] Status: ${status} (attempt ${attempts})`);

    if (status === 'finished') {
      finished = true;
      // ── Step 4: Download all slide images ──
      const exportTask = statusData.data.tasks.find(t => t.name === 'export-file');
      const files = exportTask?.result?.files || [];

      if (files.length === 0) throw new Error('CloudConvert returned no output files');

      console.log(`[CloudConvert] Downloading ${files.length} slide(s)...`);

      // Sort by filename to ensure correct slide order
      files.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));

      const slideId = `slides_${Date.now()}`;
      const slideOutputDir = path.join(__dirname, `../uploads/slides/${slideId}`);
      if (!fs.existsSync(slideOutputDir)) fs.mkdirSync(slideOutputDir, { recursive: true });

      const slidePaths = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filename = `slide-${i + 1}.png`;
        const outPath = path.join(slideOutputDir, filename);

        const response = await axios.get(file.url, { responseType: 'arraybuffer' });
        fs.writeFileSync(outPath, response.data);
        slidePaths.push(`/uploads/slides/${slideId}/${filename}`);
      }

      console.log(`[CloudConvert] ✅ Saved ${slidePaths.length} slides to ${slideOutputDir}`);
      return slidePaths;

    } else if (status === 'error') {
      const errTask = statusData.data.tasks.find(t => t.status === 'error');
      throw new Error(`CloudConvert job failed: ${errTask?.message || 'Unknown error'}`);
    }
    // else 'processing' or 'waiting' — keep polling
  }

  throw new Error('CloudConvert job timed out after 5 minutes');
}

// ─────────────────────────────────────────────
//  ROUTE: POST /api/presentation/upload-pptx
//  Upload PPT/PPTX → CloudConvert → PNG slides
//  Falls back to pptxFile iframe if key missing
// ─────────────────────────────────────────────
router.post('/upload-pptx', uploadPptx.single('file'), async (req, res) => {
  let uploadedFilePath = null;

  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });

    uploadedFilePath = req.file.path;

    // Attempt CloudConvert conversion
    let slidePaths = [];
    let usedIframeFallback = false;

    try {
      slidePaths = await convertPPTWithCloudConvert(uploadedFilePath);
    } catch (convErr) {
      console.warn('[CloudConvert] Conversion failed, using iframe fallback:', convErr.message);
      usedIframeFallback = true;
    }

    const pptxRelativePath = usedIframeFallback
      ? `/uploads/presentations/${req.file.filename}`
      : null;

    // If conversion succeeded, delete the temp PPTX to save disk space
    if (!usedIframeFallback && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }

    const presentation = new Presentation({
      title: title.trim(),
      slides: slidePaths,
      pptxFile: pptxRelativePath,
      slidePolls: []
    });
    await presentation.save();

    res.status(201).json({
      success: true,
      presentation,
      converted: !usedIframeFallback,
      message: usedIframeFallback
        ? 'PPTX saved. It will be shown via Office Online viewer (set CLOUDCONVERT_API_KEY to enable slide conversion).'
        : `Successfully converted ${slidePaths.length} slide(s) via CloudConvert!`
    });
  } catch (err) {
    console.error('[upload-pptx] Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Upload failed' });
  }
});

// ─────────────────────────────────────────────
//  ROUTE: POST /api/presentation/upload-images
//  Receive pre-rendered PNG slides from frontend
//  (used for PDF → slides flow, client-side)
// ─────────────────────────────────────────────
router.post('/upload-images', uploadImages.array('slides', 200), async (req, res) => {
  try {
    const { title } = req.body;
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ success: false, message: 'No images uploaded' });
    if (!title?.trim())
      return res.status(400).json({ success: false, message: 'Title is required' });

    const slideId = `slides_${Date.now()}`;
    const slideOutputDir = path.join(__dirname, `../uploads/slides/${slideId}`);
    if (!fs.existsSync(slideOutputDir)) fs.mkdirSync(slideOutputDir, { recursive: true });

    // Sort uploaded files by name to ensure slide order (slide-1.png, slide-2.png …)
    const sorted = [...req.files].sort((a, b) =>
      a.originalname.localeCompare(b.originalname, undefined, { numeric: true })
    );

    const slidePaths = sorted.map((file, index) => {
      const ext = path.extname(file.originalname) || '.png';
      const filename = `slide-${index + 1}${ext}`;
      const newPath = path.join(slideOutputDir, filename);
      fs.renameSync(file.path, newPath);
      return `/uploads/slides/${slideId}/${filename}`;
    });

    const presentation = new Presentation({
      title: title.trim(),
      slides: slidePaths,
      slidePolls: []
    });
    await presentation.save();

    res.status(201).json({ success: true, presentation });
  } catch (err) {
    console.error('[upload-images] Error:', err);
    res.status(500).json({ success: false, message: 'Failed to save presentation images' });
  }
});

// ─────────────────────────────────────────────
//  ROUTE: GET /api/presentation/all
// ─────────────────────────────────────────────
router.get('/all', async (req, res) => {
  try {
    const presentations = await Presentation.find().sort({ createdAt: -1 });
    res.json({ success: true, presentations });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
//  ROUTE: GET /api/presentation/:id
// ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const presentation = await Presentation.findById(req.params.id).populate('slidePolls.pollId');
    if (!presentation) return res.status(404).json({ success: false, message: 'Presentation not found' });
    res.json({ success: true, presentation });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
//  ROUTE: POST /api/presentation/:id/attach-poll
// ─────────────────────────────────────────────
router.post('/:id/attach-poll', async (req, res) => {
  try {
    const { slideIndex, pollId } = req.body;
    if (slideIndex === undefined || !pollId)
      return res.status(400).json({ success: false, message: 'slideIndex and pollId are required' });

    const presentation = await Presentation.findById(req.params.id);
    if (!presentation) return res.status(404).json({ success: false, message: 'Presentation not found' });

    // Remove any existing poll link for this slide, then add the new one
    presentation.slidePolls = presentation.slidePolls.filter(sp => sp.slideIndex !== slideIndex);
    presentation.slidePolls.push({ slideIndex, pollId });
    await presentation.save();
    await presentation.populate('slidePolls.pollId');

    res.json({ success: true, presentation });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
//  ROUTE: DELETE /api/presentation/:id/detach-poll/:slideIndex
// ─────────────────────────────────────────────
router.delete('/:id/detach-poll/:slideIndex', async (req, res) => {
  try {
    const presentation = await Presentation.findById(req.params.id);
    if (!presentation) return res.status(404).json({ success: false, message: 'Presentation not found' });

    presentation.slidePolls = presentation.slidePolls.filter(
      sp => sp.slideIndex !== parseInt(req.params.slideIndex)
    );
    await presentation.save();
    res.json({ success: true, presentation });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
//  ROUTE: PATCH /api/presentation/:id
//  Update presentation title
// ─────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });

    const presentation = await Presentation.findByIdAndUpdate(
      req.params.id,
      { title: title.trim() },
      { new: true }
    );

    if (!presentation) return res.status(404).json({ success: false, message: 'Presentation not found' });
    res.json({ success: true, presentation });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
//  ROUTE: DELETE /api/presentation/:id
//  Delete presentation and associated files
// ─────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const presentation = await Presentation.findById(req.params.id);
    if (!presentation) return res.status(404).json({ success: false, message: 'Presentation not found' });

    // Delete slide images directory if it exists
    if (presentation.slides && presentation.slides.length > 0) {
      const firstSlide = presentation.slides[0];
      const slideDir = path.join(__dirname, '..', path.dirname(firstSlide));
      if (fs.existsSync(slideDir)) {
        fs.rmSync(slideDir, { recursive: true, force: true });
      }
    }

    // Delete raw PPTX file if it exists
    if (presentation.pptxFile) {
      const pptxPath = path.join(__dirname, '..', presentation.pptxFile);
      if (fs.existsSync(pptxPath)) {
        fs.unlinkSync(pptxPath);
      }
    }

    await Presentation.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Presentation deleted successfully' });
  } catch (err) {
    console.error('[DELETE Presentation] Error:', err);
    res.status(500).json({ success: false, message: 'Server error during deletion' });
  }
});

module.exports = router;
