const mongoose = require('mongoose');

const presentationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slides: [{ type: String }], // Array of image file paths (relative to /uploads/slides/)
  pptxFile: { type: String, default: null }, // Raw PPTX file path for iframe rendering
  slidePolls: [
    {
      slideIndex: { type: Number, required: true },
      pollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Poll' }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Presentation', presentationSchema);
