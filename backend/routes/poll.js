const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');

// 10 hours in milliseconds
const EXPIRATION_TIME = 10 * 60 * 60 * 1000;

const checkExpiration = (poll) => {
  const elapsed = Date.now() - new Date(poll.createdAt).getTime();
  return elapsed > EXPIRATION_TIME;
};

// @route   POST /api/poll/create
// @desc    Create a new live poll
// @access  Private (Admin only - assuming middleware added if needed, or open for now if handled by client)
router.post('/create', async (req, res) => {
  try {
    const { questions } = req.body;
    
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
      questions,
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

module.exports = router;
