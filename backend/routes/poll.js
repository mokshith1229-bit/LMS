const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');

// Generate 6-digit alphanumeric code
const generateCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// @route   POST /api/poll/create
// @desc    Create a new live poll
// @access  Private (Admin only - assuming middleware added if needed, or open for now if handled by client)
router.post('/create', async (req, res) => {
  try {
    const { question, options } = req.body;
    
    if (!question || !options || options.length < 2) {
      return res.status(400).json({ success: false, message: 'Question and at least 2 options are required' });
    }

    let code = generateCode();
    // Ensure code uniqueness
    let existing = await Poll.findOne({ code, isActive: true });
    while (existing) {
      code = generateCode();
      existing = await Poll.findOne({ code, isActive: true });
    }

    const poll = new Poll({
      question,
      options,
      code,
      isActive: true,
      responses: []
    });

    await poll.save();
    res.status(201).json({ success: true, poll });
  } catch (error) {
    console.error('Error creating poll:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/poll/:code
// @desc    Get an active poll by code
// @access  Public
router.get('/:code', async (req, res) => {
  try {
    const poll = await Poll.findOne({ code: req.params.code.toUpperCase(), isActive: true });
    if (!poll) {
      return res.status(404).json({ success: false, message: 'Poll not found or inactive' });
    }

    // Format response data for initial pie chart load if needed
    const results = poll.options.map(opt => ({
      name: opt,
      value: poll.responses.filter(r => r.selectedOption === opt).length
    }));

    res.json({ success: true, poll, results });
  } catch (error) {
    console.error('Error fetching poll:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/poll/respond
// @desc    Submit an answer to a poll
// @access  Public
router.post('/respond', async (req, res) => {
  try {
    const { code, userKey, selectedOption } = req.body;

    if (!code || !userKey || !selectedOption) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const poll = await Poll.findOne({ code: code.toUpperCase(), isActive: true });
    if (!poll) {
      return res.status(404).json({ success: false, message: 'Poll not found or inactive' });
    }

    // Check if user already responded
    const alreadyResponded = poll.responses.find(r => r.userKey === userKey);
    if (alreadyResponded) {
      return res.status(400).json({ success: false, message: 'You have already voted in this poll' });
    }

    // Ensure valid option
    if (!poll.options.includes(selectedOption)) {
      return res.status(400).json({ success: false, message: 'Invalid option' });
    }

    poll.responses.push({ userKey, selectedOption });
    await poll.save();

    // Calculate real-time counts
    const results = poll.options.map(opt => ({
      name: opt,
      value: poll.responses.filter(r => r.selectedOption === opt).length
    }));

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(poll.code).emit("poll_update", results);
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('Error responding to poll:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
