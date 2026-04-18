const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`⚠️ MongoDB Connection Failed: ${error.message}`);
    console.log('Running in offline/no-database mode.');
  }
};

module.exports = connectDB;
