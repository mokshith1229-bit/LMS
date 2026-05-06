const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  title: { type: String, required: true, default: 'Untitled Poll' },
  questions: [
    {
      text: { type: String, required: true },
      options: [{ type: String, required: true }],
      correctAnswer: { type: String }
    }
  ],
  code: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expiresAt: { type: Date },
  // Dual reveal mode fields
  revealMode: { type: String, enum: ['live', 'delayed'], default: 'live' },
  revealDelayMinutes: { type: Number, default: 0 }, // in minutes
  revealResults: { type: Boolean, default: false }, // flipped true after timer expires
  startedAt: { type: Date, default: null }, // set when poll starts in presentation mode
  responses: [
    {
      userKey: { type: String, required: true },
      answers: [
        {
          questionIndex: { type: Number, required: true },
          selectedOption: { type: String, required: true }
        }
      ]
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Poll', pollSchema);
