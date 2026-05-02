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
  ],
  slideTransitions: [
    {
      slideIndex: { type: Number, required: true },
      type: {
        type: String,
        enum: ['none', 'fade', 'slideLeft', 'slideRight', 'zoom'],
        default: 'none'
      },
      duration: { type: Number, default: 0.4 } // seconds
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Presentation', presentationSchema);
