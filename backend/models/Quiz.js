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
    questions: [questionSchema],
    passingScore: {
      type: Number,
      default: 60, // percentage
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Quiz', quizSchema);
