const mongoose = require('mongoose');

const adminMessageSchema = new mongoose.Schema({
  medicationId: {
    type: String,
    required: true,
    index: true
  },
  medicationName: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['warning', 'promo', 'information'],
    index: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: null
  },
  priority: {
    type: Number,
    default: 0 // Higher priority messages show first
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
adminMessageSchema.index({ medicationId: 1, active: 1, category: 1 });
adminMessageSchema.index({ startDate: 1, endDate: 1 });

// Method to check if message is currently active
adminMessageSchema.methods.isCurrentlyActive = function() {
  const now = new Date();
  return this.active && 
         this.startDate <= now && 
         (this.endDate === null || this.endDate > now);
};

module.exports = mongoose.model('AdminMessage', adminMessageSchema);