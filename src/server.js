const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Trust proxy - required for Render and other hosting platforms
// Set to number of proxies between server and client (1 for Render)
app.set('trust proxy', 1);

// CORS configuration
const corsOptions = {
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
      console.warn(`CORS rejected origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Authorization'],
  maxAge: 86400 // 24 hours
};

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting configuration
// Only apply in production with proper configuration for Render
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    // Skip OPTIONS requests for CORS
    skip: (req) => req.method === 'OPTIONS',
    // Disable trust proxy validation to avoid crashes
    validate: {
      trustProxy: false,
      xForwardedForHeader: false,
    }
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS',
    validate: {
      trustProxy: false,
      xForwardedForHeader: false,
    }
  });

  app.use('/api/', limiter);
  app.use('/api/auth/', authLimiter);
}

// Routes
// Public routes
app.use('/api/categories', require('./routes/categories'));
app.use('/api/medications', require('./routes/medications'));
app.use('/api/pharmacies', require('./routes/pharmacies'));
app.use('/api/prices', require('./routes/prices'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/contact', require('./routes/contact')); // Contact form
app.use('/api/price-alerts', require('./routes/priceAlerts')); // Price alerts
app.use('/api/blog', require('./routes/blog')); // Blog posts

// Public endpoints for admin messages and subscriptions (for users)
try {
  app.use('/api/admin-messages', require('./routes/adminMessages')); // Public endpoint for fetching messages
  console.log('✅ AdminMessages routes loaded');
} catch (error) {
  console.error('❌ Error loading adminMessages routes:', error);
}

try {
  app.use('/api/subscriptions', require('./routes/subscriptions')); // Public endpoint for subscribing
  console.log('✅ Subscriptions routes loaded');
} catch (error) {
  console.error('❌ Error loading subscriptions routes:', error);
}

// Admin routes (all require authentication)
try {
  app.use('/api/admin/auth', require('./routes/adminAuth')); // Admin auth routes (login, etc.)
  app.use('/api/admin', require('./routes/admin')); // Protected admin routes (includes messages & subscriptions)
  console.log('✅ Admin routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading admin routes:', error);
  // Still allow server to start but log the error
}

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