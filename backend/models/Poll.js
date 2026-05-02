const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  title: { type: String, required: true, default: 'Untitled Poll' },
  questions: [
    {
      text: { type: String, required: true },
      options: [{ type: String, required: true }]
    }
  ],
  code: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
