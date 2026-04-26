const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Quiz = require('../models/Quiz');

async function updateDurations() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI not found in .env');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Update all quizzes to 3600 seconds (60 minutes)
    const result = await Quiz.updateMany({}, { $set: { duration: 3600 } });
    console.log(`Updated ${result.modifiedCount} quizzes to 60 minutes.`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error updating quizzes:', error);
    process.exit(1);
  }
}

updateDurations();
