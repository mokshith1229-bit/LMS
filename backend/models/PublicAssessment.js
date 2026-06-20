const mongoose = require('mongoose');
const crypto = require('crypto');

// Embedded question schema — mirrors the Quiz question schema
const publicQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: {
    type: [String],
    validate: {
      validator: (arr) => arr.length >= 2 && arr.length <= 6,
      message: 'Options must be between 2 and 6',
    },
    required: true,
  },
  correctAnswer: { type: String, required: true },
  imageUrl: { type: String, default: '' },
  section: { type: String, default: '' },
});

// Candidate field configuration
const candidateFieldSchema = new mongoose.Schema({
  fieldName: {
    type: String,
    enum: ['fullName', 'mobile', 'flatNo', 'email', 'employeeId', 'organization', 'city', 'customField'],
    required: true,
  },
  label: { type: String, default: '' }, // Custom display label
  enabled: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
});

const publicAssessmentSchema = new mongoose.Schema(
  {
    // Unique public URL token
    token: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(4).toString('hex').toUpperCase(),
    },

    // Content
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    bannerImage: { type: String, default: '' }, // Cloudinary URL
    backgroundTheme: {
      type: String,
      enum: ['banner', 'solid', 'gradient'],
      default: 'gradient',
    },
    solidColor: { type: String, default: '#4f46e5' },
    gradientFrom: { type: String, default: '#4f46e5' },
    gradientTo: { type: String, default: '#7c3aed' },

    // Candidate form fields
    candidateFields: {
      type: [candidateFieldSchema],
      default: [
        { fieldName: 'fullName', label: 'Full Name', enabled: true, required: true },
        { fieldName: 'mobile', label: 'Mobile Number', enabled: true, required: true },
        { fieldName: 'flatNo', label: 'Flat / House Number', enabled: false, required: false },
        { fieldName: 'email', label: 'Email Address', enabled: false, required: false },
        { fieldName: 'employeeId', label: 'Employee ID', enabled: false, required: false },
        { fieldName: 'organization', label: 'Organization', enabled: false, required: false },
        { fieldName: 'city', label: 'City', enabled: false, required: false },
        { fieldName: 'customField', label: 'Custom Field', enabled: false, required: false },
      ],
    },

    // Questions (copied/embedded — never references original Quiz directly for immutability)
    questions: [publicQuestionSchema],
    sourceQuizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      default: null,
    },

    // Timer
    duration: { type: Number, default: 1800 }, // seconds

    // Result settings
    passingScore: { type: Number, default: 60 },
    showScore: { type: Boolean, default: true },

    // Access control
    isActive: { type: Boolean, default: false },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },

    // Created by admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Ensure token is always uppercase and unique
publicAssessmentSchema.index({ token: 1 }, { unique: true });

module.exports =
  mongoose.models.PublicAssessment ||
  mongoose.model('PublicAssessment', publicAssessmentSchema);
