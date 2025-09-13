const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Contact = require('../models/Contact');
const rateLimit = require('express-rate-limit');
const emailService = require('../services/emailService');

// Rate limiting for contact form (prevent spam)
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many contact requests, please try again later.'
});

// POST /api/contact - Submit contact form (public)
router.post('/', contactLimiter, [
  body('name').notEmpty().trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('subject').notEmpty().trim().escape(),
  body('message').notEmpty().trim().escape()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, subject, message } = req.body;

    const contact = new Contact({
      name,
      email,
      subject,
      message,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    await contact.save();

    // Send email notification
    try {
      await emailService.sendContactFormEmail({
        name,
        email,
        subject,
        message
      });
      console.log('Contact form email sent successfully');
    } catch (emailError) {
      console.error('Failed to send contact form email:', emailError);
      // Don't fail the request if email fails, since data is saved in DB
    }

    res.status(201).json({
      message: 'Thank you for contacting us. We will get back to you soon!',
      id: contact._id
    });

  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Failed to submit contact form' });
  }
});

module.exports = router;