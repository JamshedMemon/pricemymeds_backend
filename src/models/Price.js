const mongoose = require('mongoose');

const priceSchema = new mongoose.Schema({
  medicationId: {
    type: String,
    required: true,
    index: true
  },
  pharmacyId: {
    type: String,
    required: true,
    index: true
  },
  dosage: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    default: 1
  },
  inStock: {
    type: Boolean,
    default: true
  },
  link: String,
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    enum: ['manual', 'google_sheets', 'api', 'migration'],
    default: 'manual'
  }
});

// Compound index for unique price entries
priceSchema.index({ medicationId: 1, pharmacyId: 1, dosage: 1 }, { unique: true });
priceSchema.index({ medicationId: 1, price: 1 });
priceSchema.index({ lastUpdated: -1 });

// Virtual to populate medication and pharmacy
priceSchema.virtual('medication', {
  ref: 'Medication',
  localField: 'medicationId',
  foreignField: 'id',
  justOne: true
});

priceSchema.virtual('pharmacy', {
  ref: 'Pharmacy',
  localField: 'pharmacyId',
  foreignField: 'id',
  justOne: true
});

module.exports = mongoose.model('Price', priceSchema);