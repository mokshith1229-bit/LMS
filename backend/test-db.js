const mongoose = require('mongoose');
const PublicAssessment = require('./models/PublicAssessment');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to DB');
    const token = '5C060D4A';
    const assessment = await PublicAssessment.findOne({ token });
    if (!assessment) {
      console.log('Assessment NOT FOUND with token:', token);
    } else {
      console.log('Assessment found:', {
        title: assessment.title,
        token: assessment.token,
        isActive: assessment.isActive,
        startDate: assessment.startDate,
        endDate: assessment.endDate
      });
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
