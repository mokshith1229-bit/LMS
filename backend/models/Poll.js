const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  code: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  responses: [
    {
      userKey: { type: String, required: true },
      selectedOption: { type: String, required: true }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Poll', pollSchema);
