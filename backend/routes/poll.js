const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');
const { protect } = require('../middleware/auth');

// 24 hours in milliseconds
const EXPIRATION_TIME = 24 * 60 * 60 * 1000;

const checkExpiration = (poll) => {
  if (poll.expiresAt) {
    return Date.now() > new Date(poll.expiresAt).getTime();
  }
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
    const { questions, title, revealMode, revealDelayMinutes } = req.body;
    
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
      expiresAt: new Date(Date.now() + EXPIRATION_TIME),
      revealMode: revealMode === 'delayed' ? 'delayed' : 'live',
      revealDelayMinutes: revealMode === 'delayed' ? (Number(revealDelayMinutes) || 1) : 0,
      revealResults: false,
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
      return res.status(410).json({ success: false, message: 'This poll has expired (24-hour limit)' });
    }

    res.json({ success: true, poll });
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
      return res.status(410).json({ success: false, message: 'Poll expired' });
    }

    // Check if user already responded
    const alreadyResponded = poll.responses.find(r => r.userKey === userKey);
    if (alreadyResponded) {
      return res.status(400).json({ success: false, message: 'You have already voted in this poll' });
    }

    poll.responses.push({ userKey, answers });
    await poll.save();

    const io = req.app.get('io');
    if (io) {
      if (poll.revealMode === 'delayed') {
        // Delayed mode: only emit response count to admin — hide charts
        io.to(`poll_admin_${poll.code}`).emit('poll_response_count', {
          count: poll.responses.length
        });
      } else {
        // Live mode: calculate and emit full chart data to admin (existing behavior)
        const results = poll.questions.map((q, qIndex) => {
          return q.options.map(opt => ({
            name: opt,
            value: poll.responses.reduce((acc, r) => {
              const ans = r.answers.find(a => a.questionIndex === qIndex);
              return acc + (ans && ans.selectedOption === opt ? 1 : 0);
            }, 0)
          }));
        });
        io.to(`poll_admin_${poll.code}`).emit('poll_update', results);
      }
    }

    res.json({ success: true, message: 'submitted' });
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

// @route   GET /api/poll/:id/results
// @desc    Get poll details for admin (bypasses expiration check)
// @access  Private
router.get('/:id/results', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });

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
    console.error('Error fetching admin poll:', error);
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

// @route   POST /api/poll/activate/:id
// @desc    Activate (or reactivate) a poll by its MongoDB _id
//          Called automatically when a presentation slide with a linked poll is shown.
//          - If already active & not expired → reuse (no duplicate, no reset)
//          - If expired or inactive → reactivate with fresh code
// @access  Private
router.post('/activate/:id', protect, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });

    const expired = checkExpiration(poll);

    if (poll.isActive && !expired) {
      // Already live — just return the existing session (no changes)
      const results = poll.questions.map((q, qi) =>
        q.options.map(opt => ({
          name: opt,
          value: poll.responses.reduce((acc, r) => {
            const ans = r.answers.find(a => a.questionIndex === qi);
            return acc + (ans && ans.selectedOption === opt ? 1 : 0);
          }, 0)
        }))
      );
      return res.json({ success: true, poll, results, reused: true });
    }

    if (expired) {
      // Do not reactivate and wipe responses. Just return expired poll data.
      const results = poll.questions.map((q, qi) =>
        q.options.map(opt => ({
          name: opt,
          value: poll.responses.reduce((acc, r) => {
            const ans = r.answers.find(a => a.questionIndex === qi);
            return acc + (ans && ans.selectedOption === opt ? 1 : 0);
          }, 0)
        }))
      );
      return res.json({ success: true, poll, results, reused: true, isExpired: true });
    }

    // Reactivate: generate fresh code & reset state
    let code = generateCode();
    let existing = await Poll.findOne({ code, isActive: true });
    while (existing) {
      code = generateCode();
      existing = await Poll.findOne({ code, isActive: true });
    }

    poll.code = code;
    poll.isActive = true;
    poll.responses = [];
    poll.createdAt = new Date(); // reset expiration window
    poll.expiresAt = new Date(Date.now() + EXPIRATION_TIME);
    poll.startedAt = null;
    poll.revealResults = false;
    await poll.save();

    const results = poll.questions.map(q =>
      q.options.map(opt => ({ name: opt, value: 0 }))
    );

    res.json({ success: true, poll, results, reused: false });
  } catch (err) {
    console.error('[activate poll]', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/poll/start-timer/:id
// @desc    Start the reveal countdown for a delayed-mode poll.
//          After revealDelay minutes, sets revealResults=true and emits poll_reveal.
// @access  Private
router.post('/start-timer/:id', protect, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });

    if (poll.revealMode !== 'delayed') {
      return res.status(400).json({ success: false, message: 'This poll is not in delayed reveal mode' });
    }

    if (poll.revealResults) {
      return res.status(400).json({ success: false, message: 'Results already revealed for this poll' });
    }

    const delayMs = (poll.revealDelay || 1) * 60 * 1000;
    const io = req.app.get('io');

    // Respond immediately so admin sees the timer start
    res.json({ success: true, message: `Timer started. Results will reveal in ${poll.revealDelayMinutes} minute(s).`, revealDelayMinutes: poll.revealDelayMinutes });

    // Server-side countdown — fires after revealDelayMinutes minutes
    setTimeout(async () => {
      try {
        const pollToReveal = await Poll.findById(req.params.id);
        if (!pollToReveal || pollToReveal.revealResults) return; // already revealed or deleted

        pollToReveal.revealResults = true;
        await pollToReveal.save();

        // Build full chart data for the reveal payload
        const results = pollToReveal.questions.map((q, qIndex) =>
          q.options.map(opt => ({
            name: opt,
            value: pollToReveal.responses.reduce((acc, r) => {
              const ans = r.answers.find(a => a.questionIndex === qIndex);
              return acc + (ans && ans.selectedOption === opt ? 1 : 0);
            }, 0)
          }))
        );

        if (io) {
          // Emit to both admin and student rooms
          io.to(`poll_admin_${pollToReveal.code}`).emit('poll_reveal', { results, poll: pollToReveal });
          io.to(`poll_users_${pollToReveal.code}`).emit('poll_reveal', { message: 'The poll session has concluded.' });
        }
      } catch (revealErr) {
        console.error('[poll_reveal timer]', revealErr);
      }
    }, delayMs);

  } catch (error) {
    console.error('Error starting poll timer:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/poll/:id/export
// @desc    Export poll results to Excel
// @access  Private
router.get('/:id/export', protect, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    poll.questions.forEach((q, qIndex) => {
      const sheet = workbook.addWorksheet(`Question ${qIndex + 1}`);
      
      const headerRow = ['Student Name', 'Correct Answers'];
      q.options.forEach((_, optIdx) => headerRow.push(`Option ${optIdx + 1}`));
      sheet.addRow(headerRow);
      
      const correctRow = ['', ''];
      q.options.forEach(opt => correctRow.push(opt));
      sheet.addRow(correctRow);
      
      poll.responses.forEach(response => {
        const row = [response.userKey, 'N/A'];
        const ans = response.answers.find(a => a.questionIndex === qIndex);
        q.options.forEach(opt => {
          row.push(ans && ans.selectedOption === opt ? '1' : '0');
        });
        sheet.addRow(row);
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="poll-${poll.code}-results.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting poll:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/poll/start-presentation-timer/:id
// @desc    Auto-start a poll timer for presentation mode.
//          Sets startedAt, then after revealDelayMinutes minutes emits 'poll_revealed'
//          to both admin and user socket rooms.
// @access  Private
router.post('/start-presentation-timer/:id', protect, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });

    // Record when this presentation timer started
    poll.startedAt = new Date();
    poll.revealResults = false;
    await poll.save();

    const delayMs = (poll.revealDelayMinutes || 1) * 60 * 1000;
    const io = req.app.get('io');

    // Respond immediately so the frontend can start countdown
    res.json({
      success: true,
      startedAt: poll.startedAt,
      revealDelayMinutes: poll.revealDelayMinutes,
      message: `Presentation timer started. Results reveal in ${poll.revealDelayMinutes} minute(s).`
    });

    // Server-side countdown for presentation reveal
    setTimeout(async () => {
      try {
        const p = await Poll.findById(req.params.id);
        if (!p) return;

        p.revealResults = true;
        await p.save();

        // Build full chart results
        const results = p.questions.map((q, qIndex) =>
          q.options.map(opt => ({
            name: opt,
            value: p.responses.reduce((acc, r) => {
              const ans = r.answers.find(a => a.questionIndex === qIndex);
              return acc + (ans && ans.selectedOption === opt ? 1 : 0);
            }, 0)
          }))
        );

        if (io) {
          // 'poll_revealed' — presentation-specific reveal event
          io.to(`poll_admin_${p.code}`).emit('poll_revealed', { results, poll: p });
          io.to(`poll_users_${p.code}`).emit('poll_revealed', { message: 'The session has concluded.' });
        }
      } catch (err) {
        console.error('[presentation timer reveal]', err);
      }
    }, delayMs);

  } catch (error) {
    console.error('Error starting presentation timer:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
