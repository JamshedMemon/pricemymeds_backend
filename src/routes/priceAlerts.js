const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const PriceAlert = require('../models/PriceAlert');
const rateLimit = require('express-rate-limit');

// Rate limiting for price alerts (prevent spam)
const alertLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 alerts per windowMs
  message: 'Too many price alert requests, please try again later.'
});

// POST /api/price-alerts - Create price alert (public)
router.post('/', alertLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('medicationId').notEmpty().trim(),
  body('medicationName').notEmpty().trim(),
  body('currentPrice').isNumeric(),
  body('targetPrice').isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, medicationId, medicationName, dosage, currentPrice, targetPrice, lowestPharmacy } = req.body;

    // Check if alert already exists
    const existingAlert = await PriceAlert.findOne({
      email,
      medicationId,
      dosage,
      status: 'active'
    });

    if (existingAlert) {
      // Update existing alert
      existingAlert.targetPrice = targetPrice;
      existingAlert.currentPrice = currentPrice;
      existingAlert.expiresAt = new Date(+new Date() + 90*24*60*60*1000);
      await existingAlert.save();
      
      return res.json({
        message: 'Price alert updated successfully',
        id: existingAlert._id
      });
    }

    // Create new alert
    const priceAlert = new PriceAlert({
      email,
      medicationId,
      medicationName,
      dosage,
      currentPrice,
      targetPrice,
      lowestPharmacy,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    await priceAlert.save();

    res.status(201).json({
      message: 'Price alert created! We\'ll notify you when the price drops.',
      id: priceAlert._id
    });

  } catch (error) {
    console.error('Price alert error:', error);
    res.status(500).json({ error: 'Failed to create price alert' });
  }
});

// DELETE /api/price-alerts/:id - Cancel price alert
router.delete('/:id', async (req, res) => {
  try {
    const alert = await PriceAlert.findById(req.params.id);
    
    if (!alert) {
      return res.status(404).json({ error: 'Price alert not found' });
    }

    alert.status = 'cancelled';
    await alert.save();

    res.json({ message: 'Price alert cancelled successfully' });

  } catch (error) {
    console.error('Cancel alert error:', error);
    res.status(500).json({ error: 'Failed to cancel price alert' });
  }
});

module.exports = router;