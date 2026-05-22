const express = require('express');
const router = express.Router();
const QuestionCategory = require('../models/QuestionCategory');
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/role');
const admin = checkRole('admin');
const mongoose = require('mongoose');

// @route   GET /api/categories
// @desc    Get all question categories
// @access  Protected (admin generally, but anyone creating a quiz can read)
router.get('/', protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    const categories = await QuestionCategory.find({}).sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/categories
// @desc    Create a new question category
// @access  Protected/Admin
router.post('/', protect, admin, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const cleanName = name.trim();

    // Check if exists (case insensitive)
    const existing = await QuestionCategory.findOne({ name: { $regex: new RegExp(`^${cleanName}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Category already exists' });
    }

    const category = await QuestionCategory.create({ name: cleanName, description });
    res.status(201).json({ success: true, category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/categories/:id
// @desc    Delete a category
// @access  Protected/Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const category = await QuestionCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    await category.deleteOne();
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
