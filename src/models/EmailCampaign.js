const mongoose = require('mongoose');

const emailCampaignSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true
  },
  content: {
    customText: String,
    includePriceDrops: Boolean,
    includeNewMedications: Boolean,
    includePromotions: Boolean,
    priceDropsData: [{
      medicationName: String,
      dosage: String,
      oldPrice: Number,
      newPrice: Number,
      pharmacyName: String,
      changeAmount: Number
    }],
    newMedicationsData: [{
      medicationName: String,
      dosage: mongoose.Schema.Types.Mixed,  // Can be String or Array
      description: String,
      lowestPrice: Number,
      pharmacyName: String
    }],
    promotionsData: [{
      title: String,
      message: String,
      medicationName: String,
      pharmacyName: String
    }]
  },
  targetAudience: {
    type: String,
    enum: ['all', 'priceDrops', 'newMedications', 'promotions', 'weeklyDigest', 'test'],
    required: true
  },
  recipientCount: {
    type: Number,
    default: 0
  },
  recipients: [{
    email: String,
    sentAt: Date,
    status: {
      type: String,
      enum: ['sent', 'failed', 'bounced'],
      default: 'sent'
    },
    error: String
  }],
  testEmail: String, // For test campaigns
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['draft', 'sending', 'sent', 'failed'],
    default: 'draft'
  },
  stats: {
    totalSent: { type: Number, default: 0 },
    totalFailed: { type: Number, default: 0 },
    totalBounced: { type: Number, default: 0 }
  }
});

// Index for efficient queries
emailCampaignSchema.index({ sentAt: -1 });
emailCampaignSchema.index({ status: 1 });
emailCampaignSchema.index({ targetAudience: 1 });

module.exports = mongoose.model('EmailCampaign', emailCampaignSchema);