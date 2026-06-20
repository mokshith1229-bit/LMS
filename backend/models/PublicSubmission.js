const mongoose = require('mongoose');

const publicSubmissionSchema = new mongoose.Schema(
  {
    publicAssessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PublicAssessment',
      required: true,
      index: true,
    },

    // Candidate details (flexible — only fields admin enabled)
    candidateData: {
      fullName: { type: String, default: '' },
      mobile: { type: String, default: '' },
      flatNo: { type: String, default: '' },
      email: { type: String, default: '' },
      employeeId: { type: String, default: '' },
      organization: { type: String, default: '' },
      city: { type: String, default: '' },
      customField: { type: String, default: '' },
    },

    // Answers submitted
    answers: [
      {
        questionId: { type: String, required: true },
        selectedOption: { type: String, default: null },
      },
    ],

    // Score breakdown
    correct: { type: Number, required: true, default: 0 },
    wrong: { type: Number, required: true, default: 0 },
    unattempted: { type: Number, required: true, default: 0 },
    score: { type: Number, required: true, default: 0 },
    percentage: { type: Number, required: true, default: 0 },
    passed: { type: Boolean, default: false },

    // Timing
    timeTaken: { type: Number, default: 0 }, // seconds
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

publicSubmissionSchema.index({ publicAssessmentId: 1, 'candidateData.mobile': 1 });

module.exports =
  mongoose.models.PublicSubmission ||
  mongoose.model('PublicSubmission', publicSubmissionSchema);
