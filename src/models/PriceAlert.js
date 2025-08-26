const mongoose = require('mongoose');

const priceAlertSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  medicationId: {
    type: String,
    required: true
  },
  medicationName: {
    type: String,
    required: true
  },
  dosage: String,
  currentPrice: {
    type: Number,
    required: true
  },
  targetPrice: {
    type: Number,
    required: true
  },
  lowestPharmacy: {
    name: String,
    price: Number
  },
  status: {
    type: String,
    enum: ['active', 'triggered', 'cancelled', 'expired'],
    default: 'active'
  },
  triggeredAt: Date,
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 90*24*60*60*1000) // 90 days from now
  },
  ipAddress: String,
  userAgent: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient querying
priceAlertSchema.index({ email: 1 });
priceAlertSchema.index({ medicationId: 1 });
priceAlertSchema.index({ status: 1 });
priceAlertSchema.index({ expiresAt: 1 });
priceAlertSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PriceAlert', priceAlertSchema);