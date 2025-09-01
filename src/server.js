const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [
          'https://pricemymeds.co.uk',
          'https://www.pricemymeds.co.uk',
          'http://pricemymeds.co.uk',
          'http://www.pricemymeds.co.uk',
          'https://pricemymeds.uk',
          'https://www.pricemymeds.uk',
          'http://pricemymeds.uk',
          'http://www.pricemymeds.uk'
        ]
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
    
    // Allow requests with no origin (mobile apps, Postman, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
  maxAge: 86400 // 24 hours
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000 // More lenient in development
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5 // limit auth attempts
});

// Handle preflight requests
app.options('*', cors());

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// Routes
app.use('/api/categories', require('./routes/categories'));
app.use('/api/medications', require('./routes/medications'));
app.use('/api/pharmacies', require('./routes/pharmacies'));
app.use('/api/prices', require('./routes/prices'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/contact', require('./routes/contact')); // Contact form
app.use('/api/price-alerts', require('./routes/priceAlerts')); // Price alerts
app.use('/api/blog', require('./routes/blog')); // Blog posts
app.use('/api/admin/auth', require('./routes/adminAuth')); // Admin auth routes (login, etc.)
app.use('/api/admin', require('./routes/admin')); // Protected admin routes
app.use('/api/admin-messages', require('./routes/adminMessages')); // Admin messages for medications
app.use('/api/subscriptions', require('./routes/subscriptions')); // Email subscriptions

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});