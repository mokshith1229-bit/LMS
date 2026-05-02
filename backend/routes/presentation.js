const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Presentation = require('../models/Presentation');

// ─────────────────────────────────────────────
//  Cloudinary Configuration
// ─────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ─────────────────────────────────────────────
//  Directory Setup (Keep for temporary processing)
// ─────────────────────────────────────────────
const tempDir = path.join(__dirname, '../uploads/temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// ─────────────────────────────────────────────
//  Multer: Temporary Local Storage for Processing
// ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempDir),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 6)}${path.extname(file.originalname)}`)
});

const uploadLocal = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB
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

  const { data: jobData } = await axios.post(
    `${CC_API}/jobs`,
    {
      tasks: {
        'import-file': { operation: 'import/upload' },
        'convert-file': {
          operation: 'convert',
          input: 'import-file',
          output_format: 'png',
          engine: 'office',
          density: 150
        },
        'export-file': { operation: 'export/url', input: 'convert-file' }
      }
    },
    { headers }
  );

  const job = jobData.data;
  const jobId = job.id;
  const importTask = job.tasks.find(t => t.name === 'import-file');

  if (!importTask?.result?.form) throw new Error('CloudConvert did not return an upload URL');

  console.log('[CloudConvert] Uploading file...');
  const { url: uploadUrl, parameters: uploadParams } = importTask.result.form;

  const form = new FormData();
  for (const [key, value] of Object.entries(uploadParams)) form.append(key, value);
  form.append('file', fs.createReadStream(filePath));

  await axios.post(uploadUrl, form, { headers: form.getHeaders(), maxBodyLength: Infinity });

  console.log('[CloudConvert] Waiting for conversion...');
  let finished = false;
  let attempts = 0;
  const MAX_ATTEMPTS = 60;

  while (!finished && attempts < MAX_ATTEMPTS) {
    await new Promise(r => setTimeout(r, 5000));
    attempts++;

    const { data: statusData } = await axios.get(`${CC_API}/jobs/${jobId}`, { headers });
    const status = statusData.data.status;

    console.log(`[CloudConvert] Status: ${status} (attempt ${attempts})`);

    if (status === 'finished') {
      finished = true;
      const exportTask = statusData.data.tasks.find(t => t.name === 'export-file');
      const files = exportTask?.result?.files || [];

      if (files.length === 0) throw new Error('CloudConvert returned no output files');

      console.log(`[CloudConvert] Uploading ${files.length} slide(s) to Cloudinary...`);

      // Sort by filename to ensure correct slide order
      files.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));

      const slideUrls = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Stream directly from CloudConvert to Cloudinary to save local disk/credits
        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'lms/slides', public_id: `slide-${Date.now()}-${i}` },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          axios.get(file.url, { responseType: 'stream' }).then(response => {
            response.data.pipe(uploadStream);
          }).catch(reject);
        });
        slideUrls.push(uploadResult.secure_url);
      }

      console.log(`[CloudConvert] ✅ Uploaded ${slideUrls.length} slides to Cloudinary`);
      return slideUrls;

    } else if (status === 'error') {
      const errTask = statusData.data.tasks.find(t => t.status === 'error');
      throw new Error(`CloudConvert job failed: ${errTask?.message || 'Unknown error'}`);
    }
  }

  throw new Error('CloudConvert job timed out after 5 minutes');
}

// ─────────────────────────────────────────────
//  ROUTE: POST /api/presentation/upload-pptx
//  Upload PPT/PPTX → CloudConvert → Cloudinary Slides
//  Falls back to raw PPTX on Cloudinary if key missing
// ─────────────────────────────────────────────
router.post('/upload-pptx', uploadLocal.single('file'), async (req, res) => {
  let localPath = null;

  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });

    localPath = req.file.path;

    let slideUrls = [];
    let usedIframeFallback = false;
    let pptxCloudUrl = null;

    try {
      slideUrls = await convertPPTWithCloudConvert(localPath);
    } catch (convErr) {
      console.warn('[CloudConvert] Conversion failed, uploading raw file to Cloudinary:', convErr.message);
      usedIframeFallback = true;
      
      // Upload raw file to Cloudinary for permanent storage (iframe fallback)
      const uploadResult = await cloudinary.uploader.upload(localPath, {
        resource_type: 'raw',
        folder: 'lms/pptx'
      });
      pptxCloudUrl = uploadResult.secure_url;
    }

    // Clean up local temp file
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);

    const presentation = new Presentation({
      title: title.trim(),
      slides: slideUrls,
      pptxFile: pptxCloudUrl,
      slidePolls: []
    });
    await presentation.save();

    res.status(201).json({
      success: true,
      presentation,
      converted: !usedIframeFallback,
      message: usedIframeFallback
        ? 'PPTX uploaded to Cloudinary. It will be shown via Office Online viewer.'
        : `Successfully converted ${slideUrls.length} slide(s) and saved to Cloudinary!`
    });
  } catch (err) {
    console.error('[upload-pptx] Error:', err);
    if (localPath && fs.existsSync(localPath)) fs.unlinkSync(localPath);
    res.status(500).json({ success: false, message: err.message || 'Upload failed' });
  }
});

// ─────────────────────────────────────────────
//  ROUTE: POST /api/presentation/upload-images
//  Receive pre-rendered PNG slides (client-side PDF conversion)
//  Upload them to Cloudinary for permanent storage
// ─────────────────────────────────────────────
router.post('/upload-images', uploadLocal.array('slides', 200), async (req, res) => {
  try {
    const { title } = req.body;
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ success: false, message: 'No images uploaded' });
    if (!title?.trim())
      return res.status(400).json({ success: false, message: 'Title is required' });

    console.log(`[upload-images] Uploading ${req.files.length} images to Cloudinary...`);

    // Sort uploaded files to ensure slide order
    const sorted = [...req.files].sort((a, b) =>
      a.originalname.localeCompare(b.originalname, undefined, { numeric: true })
    );

    const slideUrls = [];
    for (const file of sorted) {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'lms/slides'
      });
      slideUrls.push(result.secure_url);
      // Clean up local temp file
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }

    const presentation = new Presentation({
      title: title.trim(),
      slides: slideUrls,
      slidePolls: []
    });
    await presentation.save();

    res.status(201).json({ success: true, presentation });
  } catch (err) {
    console.error('[upload-images] Error:', err);
    // Cleanup any remaining temp files on error
    if (req.files) {
      req.files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
    }
    res.status(500).json({ success: false, message: 'Failed to save presentation images' });
  }
});

// ─────────────────────────────────────────────
//  Standard Routes (GET, UPDATE, DELETE)
// ─────────────────────────────────────────────
router.get('/all', async (req, res) => {
  try {
    const presentations = await Presentation.find().sort({ createdAt: -1 });
    res.json({ success: true, presentations });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const presentation = await Presentation.findById(req.params.id).populate('slidePolls.pollId');
    if (!presentation) return res.status(404).json({ success: false, message: 'Presentation not found' });
    res.json({ success: true, presentation });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    const presentation = await Presentation.findByIdAndUpdate(req.params.id, { title: title.trim() }, { new: true });
    if (!presentation) return res.status(404).json({ success: false, message: 'Presentation not found' });
    res.json({ success: true, presentation });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const presentation = await Presentation.findById(req.params.id);
    if (!presentation) return res.status(404).json({ success: false, message: 'Presentation not found' });

    // With Cloudinary, we could delete from Cloudinary here if we stored public_ids,
    // but for simplicity we'll just delete the DB record. Cloudinary storage is permanent.
    
    await Presentation.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Presentation deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/:id/attach-poll', async (req, res) => {
  try {
    const { slideIndex, pollId } = req.body;
    const presentation = await Presentation.findById(req.params.id);
    if (!presentation) return res.status(404).json({ success: false, message: 'Presentation not found' });
    presentation.slidePolls = presentation.slidePolls.filter(sp => sp.slideIndex !== slideIndex);
    presentation.slidePolls.push({ slideIndex, pollId });
    await presentation.save();
    await presentation.populate('slidePolls.pollId');
    res.json({ success: true, presentation });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
