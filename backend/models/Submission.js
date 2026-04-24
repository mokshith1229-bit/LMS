const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
    index: true,
  },
  answers: {
    type: [mongoose.Schema.Types.Mixed],
    required: true,
  },
  correct: {
    type: Number,
    required: true,
  },
  wrong: {
    type: Number,
    required: true,
  },
  unattempted: {
    type: Number,
    required: true,
  },
  percentage: {
    type: Number,
    required: true,
  },
  timeTaken: {
    type: Number, // in seconds
  },
  passed: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['COMPLETED', 'TERMINATED'],
    default: 'COMPLETED',
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

submissionSchema.index({ userId: 1, quizId: 1 });

module.exports = mongoose.model('Submission', submissionSchema);
