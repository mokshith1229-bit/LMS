const mongoose = require('mongoose');
const PublicAssessment = require('./models/PublicAssessment');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to DB');
    const token = '5C060D4A';
    
    const assessment = await PublicAssessment.findOneAndUpdate(
      { token },
      { $set: { startDate: null, endDate: null } },
      { new: true }
    );
    
    if (assessment) {
      console.log('Successfully cleared startDate and endDate for assessment:', token);
    } else {
      console.log('Assessment not found!');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
