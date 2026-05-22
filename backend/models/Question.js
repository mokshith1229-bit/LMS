const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  options: {
    type: [String],
    required: true,
  },
  correctAnswer: {
    type: String,
    required: true,
  },
  section: {
    type: String,
    default: '',
  },
});

module.exports = mongoose.models.Question || mongoose.model('Question', questionSchema);
