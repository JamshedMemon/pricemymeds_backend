const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
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
  category: {
    type: String,
    required: true,
    index: true
  },
  subcategory: {
    type: String,
    required: true,
    index: true
  },
  description: String,
  dosage: [{
    type: String
  }],
  form: {
    type: String // tablets, injection, capsules, etc.
  },
  genericName: String,
  active: {
    type: Boolean,
    default: true
  },
  searchTerms: [String], // For better search functionality
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for efficient queries
medicationSchema.index({ category: 1, subcategory: 1 });
medicationSchema.index({ name: 'text', description: 'text', searchTerms: 'text' });

// Virtual for full name with form
medicationSchema.virtual('fullName').get(function() {
  return this.form ? `${this.name} ${this.form}` : this.name;
});

module.exports = mongoose.model('Medication', medicationSchema);