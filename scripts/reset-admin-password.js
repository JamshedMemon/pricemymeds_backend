#!/usr/bin/env node

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../src/models/User');

async function resetAdminPassword() {
  try {
    console.log('🔐 Resetting Admin Password...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find admin user
    const admin = await User.findOne({ email: 'admin@pricemymeds.co.uk' });
    
    if (!admin) {
      console.error('❌ Admin user not found');
      process.exit(1);
    }
    
    console.log('👤 Found admin user:', admin.email);
    
    // Set new password
    const newPassword = 'Admin123!';  // New temporary password
    
    // Set plain text password - the model's pre-save hook will hash it
    admin.password = newPassword;
    
    // Save the user
    await admin.save();
    
    console.log('✅ Password reset successfully!');
    console.log('');
    console.log('📝 New Login Credentials:');
    console.log('========================');
    console.log('Email: admin@pricemymeds.co.uk');
    console.log('Password: Admin123!');
    console.log('');
    console.log('⚠️  Please change this password immediately after logging in!');
    
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the reset
resetAdminPassword();