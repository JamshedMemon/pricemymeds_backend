const mongoose = require('mongoose');

const pharmacySchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    index: true
  },
  website: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  deliveryTime: {
    type: String,
    default: '1-3 days'
  },
  prescriptionRequired: {
    type: Boolean,
    default: true
  },
  logo: String,
  active: {
    type: Boolean,
    default: true
  },
  verified: {
    type: Boolean,
    default: false
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

pharmacySchema.index({ name: 1 });
pharmacySchema.index({ rating: -1 });

module.exports = mongoose.model('Pharmacy', pharmacySchema);