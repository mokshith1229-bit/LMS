const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  options: {
    type: [String],
    validate: {
      validator: (arr) => arr.length >= 2 && arr.length <= 6,
      message: 'Options must be between 2 and 6',
    },
    required: true,
  },
  correctAnswer: {
    type: String, 
    required: true,
  },
  // Optional: image attached to this question (Cloudinary URL)
  imageUrl: {
    type: String,
    default: '',
  },
  section: {
    type: String,
    default: '',
  },
  // Future: difficulty tagging support (not active yet)
  // difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
});

const quizSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    duration: {
      type: Number,
      default: 1800, // seconds
    },
    // Master question pool — all uploaded questions
    questions: [questionSchema],
    passingScore: {
      type: Number,
      default: 60, // percentage
    },
    instructions: {
      type: String,
      default: "",
    },

    // ── Dynamic Assessment Engine Config ──────────────────────────────────────
    // How many questions each student receives (null = all questions, backward compat)
    questionsPerStudent: {
      type: Number,
      default: null,
    },
    // Randomize the ORDER in which selected questions are displayed
    shuffleQuestions: {
      type: Boolean,
      default: false,
    },
    // Randomize the ORDER of options (A/B/C/D) for each MCQ
    shuffleOptions: {
      type: Boolean,
      default: false,
    },
    sectionDistribution: {
      type: [{
        section: { type: String, required: true },
        questionsToDeliver: { type: Number, required: true }
      }],
      default: []
    },
    // Future hooks (not active):
    // difficultyMode: { type: String, enum: ['uniform', 'balanced'], default: 'uniform' },
    // sections: [sectionSchema],
    // ─────────────────────────────────────────────────────────────────────────
  },
  { timestamps: true }
);

module.exports = mongoose.models.Quiz || mongoose.model('Quiz', quizSchema);
