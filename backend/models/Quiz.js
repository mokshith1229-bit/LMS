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
    type: Number, // index of the correct option
    required: true,
  },
});

const quizSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    questions: [questionSchema],
    timeLimitSeconds: {
      type: Number,
      default: 600, // 10 minutes default
    },
    passingScore: {
      type: Number,
      default: 60, // percentage
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Quiz', quizSchema);
