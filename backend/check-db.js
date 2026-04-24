const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  console.log('Checking connection status for:', process.env.MONGO_URI.split('@')[1]); // Log only the host part for security
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('STATUS: Connected to MongoDB ✅');
    process.exit(0);
  } catch (err) {
    console.error('STATUS: FAILED to connect ❌');
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

check();
