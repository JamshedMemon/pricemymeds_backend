const AuditLog = require('../models/AuditLog');

const logAction = async (req, action, entity, entityId, changes) => {
  try {
    const auditEntry = new AuditLog({
      user: req.user._id,
      action,
      entity,
      entityId,
      changes,
      metadata: {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        source: 'admin_dashboard'
      }
    });
    
    await auditEntry.save();
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break the main operation
  }
};

// Middleware to automatically log certain actions
const auditMiddleware = (action, entityExtractor) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entity = entityExtractor(req);
        logAction(req, action, entity.type, entity.id, req.body);
      }
      originalSend.call(res, data);
    };
    
    next();
  };
};

module.exports = {
  logAction,
  auditMiddleware
};