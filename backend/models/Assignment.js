const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true,
    },
    status: {
      type: String,
      enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'TERMINATED'],
      default: 'NOT_STARTED',
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    startedAt: {
      type: Date,
    },
    submittedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

assignmentSchema.index({ userId: 1, quizId: 1 }, { unique: true });

module.exports = mongoose.model('Assignment', assignmentSchema);
