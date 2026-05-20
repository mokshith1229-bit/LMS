const mongoose = require('mongoose');

// ── Attempt Paper Item ───────────────────────────────────────────────────────
// Each entry represents one question as the student saw it.
// This snapshot is FROZEN at exam start and never regenerated.
const attemptPaperItemSchema = new mongoose.Schema({
  questionId:      { type: String, required: true },   // _id from master quiz pool
  questionText:    { type: String, required: true },
  imageUrl:        { type: String, default: '' },
  shuffledOptions: { type: [String], required: true }, // options in shuffled order shown to student
  correctAnswer:   { type: String, required: true },   // index (as string) into shuffledOptions
  displayedOrder:  { type: Number, required: true },   // 0-based position on student's paper
  // selectedAnswer stored in Submission.answers; kept here for future self-contained lookup
}, { _id: false });
// ─────────────────────────────────────────────────────────────────────────────

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

    // ── Dynamic Assessment Engine: Frozen Paper Snapshot ─────────────────────
    // Generated ONCE when the student first opens the exam.
    // All downstream systems (submit, PDF, analytics) read from here.
    // Empty array = no snapshot yet (or legacy assignment before randomization feature).
    attemptPaper: {
      type: [attemptPaperItemSchema],
      default: [],
    },
    // ─────────────────────────────────────────────────────────────────────────
  },
  { timestamps: true }
);

assignmentSchema.index({ userId: 1, quizId: 1 }, { unique: true });

module.exports = mongoose.model('Assignment', assignmentSchema);

