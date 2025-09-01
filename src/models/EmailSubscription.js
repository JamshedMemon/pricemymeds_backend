const mongoose = require('mongoose');

const emailSubscriptionSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  subscribedTo: [{
    type: {
      type: String,
      enum: ['all', 'category', 'medication'],
      required: true
    },
    value: String // Category name or medication ID
  }],
  preferences: {
    priceDrops: {
      type: Boolean,
      default: true
    },
    newMedications: {
      type: Boolean,
      default: true
    },
    promotions: {
      type: Boolean,
      default: true
    },
    weeklyDigest: {
      type: Boolean,
      default: false
    }
  },
  status: {
    type: String,
    enum: ['active', 'unsubscribed', 'bounced'],
    default: 'active'
  },
  unsubscribeToken: {
    type: String,
    unique: true,
    sparse: true
  },
  lastEmailSent: {
    type: Date,
    default: null
  },
  emailsSentCount: {
    type: Number,
    default: 0
  },
  source: {
    type: String,
    enum: ['popup', 'footer', 'checkout', 'manual'],
    default: 'popup'
  },
  subscribedAt: {
    type: Date,
    default: Date.now
  },
  unsubscribedAt: {
    type: Date,
    default: null
  }
});

// Generate unsubscribe token before saving
emailSubscriptionSchema.pre('save', function(next) {
  if (!this.unsubscribeToken) {
    this.unsubscribeToken = require('crypto').randomBytes(32).toString('hex');
  }
  next();
});

// Method to safely unsubscribe
emailSubscriptionSchema.methods.unsubscribe = function() {
  this.status = 'unsubscribed';
  this.unsubscribedAt = new Date();
  return this.save();
};

// Static method to find or create subscription
emailSubscriptionSchema.statics.findOrCreate = async function(email, source = 'popup') {
  let subscription = await this.findOne({ email: email.toLowerCase() });
  
  if (!subscription) {
    subscription = new this({
      email: email.toLowerCase(),
      source: source,
      subscribedTo: [{ type: 'all', value: null }]
    });
    await subscription.save();
  } else if (subscription.status === 'unsubscribed') {
    // Reactivate if previously unsubscribed
    subscription.status = 'active';
    subscription.unsubscribedAt = null;
    await subscription.save();
  }
  
  return subscription;
};

module.exports = mongoose.model('EmailSubscription', emailSubscriptionSchema);