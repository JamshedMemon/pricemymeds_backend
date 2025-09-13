const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const priceAlertService = require('../services/priceAlertService');
const weeklyDigestService = require('../services/weeklyDigestService');

// Test email service endpoint - for development/testing only
router.post('/test-email', async (req, res) => {
  try {
    // Only allow in development mode for security
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Test endpoint disabled in production' });
    }

    const result = await emailService.sendTestEmail();
    
    if (result.success) {
      res.json({ 
        message: 'Test email sent successfully', 
        messageId: result.messageId 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to send test email', 
        details: result.error 
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      error: 'Failed to send test email', 
      details: error.message 
    });
  }
});

// Test price alerts manually - for development/testing only
router.post('/test-price-alerts', async (req, res) => {
  try {
    // Only allow in development mode for security
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Test endpoint disabled in production' });
    }

    // Trigger price alert check manually
    await priceAlertService.testPriceAlerts();
    
    res.json({ 
      message: 'Price alert check triggered successfully',
      note: 'Check server logs for details'
    });
  } catch (error) {
    console.error('Test price alerts error:', error);
    res.status(500).json({ 
      error: 'Failed to trigger price alert check', 
      details: error.message 
    });
  }
});

module.exports = router;