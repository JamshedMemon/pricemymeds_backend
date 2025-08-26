#!/usr/bin/env node

const crypto = require('crypto');

console.log('🔐 Generating secure JWT secret for production...\n');

// Generate a 64-byte random string
const secret = crypto.randomBytes(64).toString('base64');

console.log('Add this to your production .env file:');
console.log('=====================================');
console.log(`JWT_SECRET=${secret}`);
console.log('=====================================\n');

console.log('⚠️  IMPORTANT:');
console.log('1. Keep this secret secure - never commit it to git');
console.log('2. Use different secrets for different environments');
console.log('3. Store securely in your production environment variables');
console.log('4. Consider using a key management service for production\n');

console.log('For testing, your current JWT_SECRET in .env is:');
console.log(process.env.JWT_SECRET || 'Not set');