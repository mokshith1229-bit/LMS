const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');
const { protect } = require('../middleware/auth');

// 10 hours in milliseconds
const EXPIRATION_TIME = 10 * 60 * 60 * 1000;

const checkExpiration = (poll) => {
  const elapsed = Date.now() - new Date(poll.createdAt).getTime();
  return elapsed > EXPIRATION_TIME;
};

// Generate 6-digit alphanumeric code
const generateCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// @route   POST /api/poll/create
// @desc    Create a new live poll
// @access  Private
router.post('/create', protect, async (req, res) => {
  try {
    const { questions, title } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Poll name is required' });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one question is required' });
    }

    let code = generateCode();
    // Ensure code uniqueness
    let existing = await Poll.findOne({ code, isActive: true });
    while (existing) {
      code = generateCode();
      existing = await Poll.findOne({ code, isActive: true });
    }

    const poll = new Poll({
      title: title.trim(),
      questions,
      code,
      isActive: true,
      creator: req.user._id,
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

    if (checkExpiration(poll)) {
      return res.status(410).json({ success: false, message: 'This poll has expired (10-hour limit)' });
    }

    // Format response data for initial pie chart load (array of arrays)
    const results = poll.questions.map((q, qIndex) => {
      return q.options.map(opt => ({
        name: opt,
        value: poll.responses.reduce((acc, r) => {
          const answer = r.answers.find(a => a.questionIndex === qIndex);
          return acc + (answer && answer.selectedOption === opt ? 1 : 0);
        }, 0)
      }));
    });

    res.json({ success: true, poll, results });
  } catch (error) {
    console.error('Error fetching poll:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/poll/respond
// @desc    Submit answers to a poll
// @access  Public
router.post('/respond', async (req, res) => {
  try {
    const { code, userKey, answers } = req.body;

    if (!code || !userKey || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'Missing required fields or invalid answers' });
    }

    const poll = await Poll.findOne({ code: code.toUpperCase(), isActive: true });
    if (!poll) {
      return res.status(404).json({ success: false, message: 'Poll not found or inactive' });
    }

    if (checkExpiration(poll)) {
      return res.status(410).json({ success: false, message: 'This poll has expired and is no longer accepting responses.' });
    }

    // Check if user already responded
    const alreadyResponded = poll.responses.find(r => r.userKey === userKey);
    if (alreadyResponded) {
      return res.status(400).json({ success: false, message: 'You have already voted in this poll' });
    }

    poll.responses.push({ userKey, answers });
    await poll.save();

    // Calculate real-time counts (array of arrays)
    const results = poll.questions.map((q, qIndex) => {
      return q.options.map(opt => ({
        name: opt,
        value: poll.responses.reduce((acc, r) => {
          const ans = r.answers.find(a => a.questionIndex === qIndex);
          return acc + (ans && ans.selectedOption === opt ? 1 : 0);
        }, 0)
      }));
    });

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

// @route   GET /api/poll/admin/all
// @desc    Get all polls for admin dashboard
// @access  Private
router.get('/admin/all', protect, async (req, res) => {
  try {
    const polls = await Poll.find().sort({ createdAt: -1 });
    // Add expiration status to each poll
    const pollsWithStatus = polls.map(p => ({
      ...p._doc,
      isExpired: checkExpiration(p)
    }));
    res.json({ success: true, polls: pollsWithStatus });
  } catch (error) {
    console.error('Error fetching all polls:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/poll/:id
// @desc    Delete a poll completely
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    
    if (!poll) {
      return res.status(404).json({ success: false, message: 'Poll not found' });
    }

    // Check authorization: Admin or Creator
    const isAdmin = req.user.role === 'admin';
    const isCreator = poll.creator && poll.creator.toString() === req.user._id.toString();

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this poll' });
    }

    await Poll.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Poll deleted successfully' });
  } catch (error) {
    console.error('Error deleting poll:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
