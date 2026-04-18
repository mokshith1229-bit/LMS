const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Module title is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['video', 'ppt', 'quiz'],
      required: true,
    },
    url: {
      type: String,
      default: '',
    },
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      default: null,
    },
    order: {
      type: Number,
      default: 0,
    },
    duration: {
      type: Number, // in seconds, for video
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Module', moduleSchema);
