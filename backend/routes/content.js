const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Course = require('../models/Course');
const Module = require('../models/Module');
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/role');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname.replace(/\s+/g, '_')}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'video/mp4', 'video/webm', 'video/ogg',
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/octet-stream',
  ];
  if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Upload video, PDF, or PPT files.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// @route   POST /api/content/upload
// @access  Admin only
router.post(
  '/upload',
  protect,
  checkRole('admin'),
  upload.single('file'),
  async (req, res) => {
    try {
      const { courseId, title, type, order } = req.body;

      if (!courseId || !title || !type) {
        return res.status(400).json({ success: false, message: 'courseId, title, and type are required' });
      }

      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ success: false, message: 'Course not found' });
      }

      let fileUrl = '';
      if (req.file) {
        fileUrl = `/uploads/${req.file.filename}`;
      } else if (req.body.url) {
        fileUrl = req.body.url; // allow external URL
      }

      const module = await Module.create({
        courseId,
        title,
        type,
        url: fileUrl,
        order: order || course.modules.length,
      });

      course.modules.push(module._id);
      await course.save();

      res.status(201).json({ success: true, module });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// @route   GET /api/content/modules/:courseId
// @access  Private
router.get('/modules/:courseId', protect, async (req, res) => {
  try {
    const modules = await Module.find({ courseId: req.params.courseId }).sort('order');
    res.json({ success: true, modules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/content/:moduleId
// @access  Admin only
router.delete('/:moduleId', protect, checkRole('admin'), async (req, res) => {
  try {
    const module = await Module.findByIdAndDelete(req.params.moduleId);
    if (!module) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }
    // Remove from course
    await Course.findByIdAndUpdate(module.courseId, {
      $pull: { modules: module._id },
    });
    res.json({ success: true, message: 'Module deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
