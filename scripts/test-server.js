#!/usr/bin/env node

const axios = require('axios');
const colors = require('colors');

const API_URL = process.env.API_URL || 'http://localhost:5000';
let token = '';

// Test utilities
const test = async (name, fn) => {
  try {
    await fn();
    console.log(`✅ ${name}`.green);
  } catch (error) {
    console.log(`❌ ${name}`.red);
    console.error(`   ${error.message}`.gray);
  }
};

const api = axios.create({
  baseURL: API_URL,
  timeout: 5000
});

// Add auth token to requests
api.interceptors.request.use(config => {
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function runTests() {
  console.log('\n🧪 Testing PriceMyMeds Backend API'.cyan.bold);
  console.log(`📍 API URL: ${API_URL}`.gray);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'.gray);
  
  // Health check
  await test('Health check', async () => {
    const res = await api.get('/health');
    if (res.data.status !== 'OK') throw new Error('Health check failed');
  });
  
  console.log('\n📋 Public Endpoints:'.cyan);
  
  // Test categories endpoint
  await test('GET /api/categories', async () => {
    const res = await api.get('/api/categories');
    if (!Array.isArray(res.data)) throw new Error('Expected array of categories');
    console.log(`   Found ${res.data.length} categories`.gray);
  });
  
  // Test medications endpoint
  await test('GET /api/medications', async () => {
    const res = await api.get('/api/medications?limit=5');
    if (!Array.isArray(res.data)) throw new Error('Expected array of medications');
    console.log(`   Found ${res.data.length} medications`.gray);
  });
  
  // Test pharmacies endpoint
  await test('GET /api/pharmacies', async () => {
    const res = await api.get('/api/pharmacies');
    if (!Array.isArray(res.data)) throw new Error('Expected array of pharmacies');
    console.log(`   Found ${res.data.length} pharmacies`.gray);
  });
  
  // Test search endpoint
  await test('GET /api/medications/search/viagra', async () => {
    const res = await api.get('/api/medications/search/viagra');
    if (!Array.isArray(res.data)) throw new Error('Expected array of search results');
    console.log(`   Found ${res.data.length} results`.gray);
  });
  
  console.log('\n🔐 Authentication:'.cyan);
  
  // Test login
  await test('POST /api/auth/login', async () => {
    const res = await api.post('/api/auth/login', {
      email: 'admin@pricemymeds.co.uk',
      password: 'ChangeMeNow123!'
    });
    if (!res.data.token) throw new Error('No token received');
    token = res.data.token;
    console.log(`   Logged in as ${res.data.user.email}`.gray);
  });
  
  // Test protected endpoint
  await test('GET /api/auth/me', async () => {
    const res = await api.get('/api/auth/me');
    if (!res.data.user) throw new Error('No user data received');
  });
  
  console.log('\n👨‍💼 Admin Endpoints:'.cyan);
  
  // Test admin stats
  await test('GET /api/admin/stats', async () => {
    const res = await api.get('/api/admin/stats');
    if (!res.data.totalMedications) throw new Error('No stats received');
    console.log(`   Total medications: ${res.data.totalMedications}`.gray);
    console.log(`   Total pharmacies: ${res.data.totalPharmacies}`.gray);
    console.log(`   Total prices: ${res.data.totalPrices}`.gray);
  });
  
  // Test medications admin endpoint
  await test('GET /api/admin/medications', async () => {
    const res = await api.get('/api/admin/medications?page=1&limit=5');
    if (!res.data.medications) throw new Error('No medications data');
    console.log(`   Page 1 of ${res.data.pagination.pages}`.gray);
  });
  
  // Test audit logs
  await test('GET /api/admin/audit-logs', async () => {
    const res = await api.get('/api/admin/audit-logs?limit=5');
    if (!res.data.logs) throw new Error('No audit logs');
    console.log(`   Found ${res.data.logs.length} audit logs`.gray);
  });
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'.gray);
  console.log('✅ All tests passed!'.green.bold);
  console.log('\n📝 Next steps:'.yellow);
  console.log('1. Change the default admin password');
  console.log('2. Update frontend to use the API');
  console.log('3. Set up proper environment variables');
  console.log('4. Deploy to production\n');
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:'.red, error.message);
  process.exit(1);
});