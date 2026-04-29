const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function listUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({}).limit(5);
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listUsers();
