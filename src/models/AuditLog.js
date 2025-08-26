const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'price_update',
      'price_bulk_update',
      'medication_create',
      'medication_update',
      'medication_delete',
      'pharmacy_create',
      'pharmacy_update',
      'pharmacy_delete',
      'category_update',
      'user_login',
      'data_import',
      'data_export'
    ]
  },
  entity: {
    type: String,
    required: true
  },
  entityId: String,
  changes: mongoose.Schema.Types.Mixed,
  metadata: {
    ipAddress: String,
    userAgent: String,
    source: {
      type: String,
      enum: ['admin_dashboard', 'api', 'migration', 'google_sheets']
    }
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Indexes for efficient querying
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);