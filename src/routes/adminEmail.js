const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { verifyToken } = require('../middleware/auth');
const adminEmailService = require('../services/adminEmailService');
const EmailCampaign = require('../models/EmailCampaign');

// GET /api/admin/email/data - Get data for email composer
router.get('/data', verifyToken, async (req, res) => {
  try {
    // Fetch all available data in parallel
    const [newMedications, priceDrops, promotions, subscriberCounts] = await Promise.all([
      adminEmailService.getNewMedicationsThisWeek(),
      adminEmailService.getPriceDropsThisWeek(),
      adminEmailService.getPromotionsThisWeek(),
      adminEmailService.getSubscriberCounts()
    ]);

    res.json({
      newMedications,
      priceDrops,
      promotions,
      subscriberCounts,
      message: priceDrops.length === 0 ? 'Note: Price drops tracking requires PriceHistory implementation' : null
    });
  } catch (error) {
    console.error('Error fetching email data:', error);
    res.status(500).json({ error: 'Failed to fetch email data' });
  }
});

// POST /api/admin/email/preview - Preview email before sending
router.post('/preview', [
  verifyToken,
  body('subject').notEmpty().withMessage('Subject is required'),
  body('targetAudience').isIn(['all', 'priceDrops', 'newMedications', 'promotions', 'weeklyDigest', 'test'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { subject, content, targetAudience } = req.body;

    // Create a preview campaign (not saved)
    const previewCampaign = {
      subject,
      content,
      targetAudience
    };

    // Get recipient count
    const subscriberCounts = await adminEmailService.getSubscriberCounts();
    let recipientCount = 0;

    switch (targetAudience) {
      case 'all':
        recipientCount = subscriberCounts.all;
        break;
      case 'priceDrops':
        recipientCount = subscriberCounts.priceDrops;
        break;
      case 'newMedications':
        recipientCount = subscriberCounts.newMedications;
        break;
      case 'promotions':
        recipientCount = subscriberCounts.promotions;
        break;
      case 'weeklyDigest':
        recipientCount = subscriberCounts.weeklyDigest;
        break;
      case 'test':
        recipientCount = 1;
        break;
    }

    // Build HTML preview
    const htmlPreview = adminEmailService.buildEmailContent(previewCampaign);

    res.json({
      subject,
      targetAudience,
      recipientCount,
      htmlPreview,
      content
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// POST /api/admin/email/test - Send test email
router.post('/test', [
  verifyToken,
  body('subject').notEmpty().withMessage('Subject is required'),
  body('testEmail').isEmail().withMessage('Valid test email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { subject, content, testEmail } = req.body;

    // Create test campaign
    const testCampaign = new EmailCampaign({
      subject,
      content,
      targetAudience: 'test',
      testEmail,
      sentBy: req.user.id,
      status: 'sending'
    });

    await testCampaign.save();

    // Send test email
    const result = await adminEmailService.sendTestEmail(testCampaign, testEmail);

    // Update campaign status
    testCampaign.status = result.success ? 'sent' : 'failed';
    testCampaign.recipients = [{
      email: testEmail,
      sentAt: new Date(),
      status: result.success ? 'sent' : 'failed',
      error: result.error
    }];
    testCampaign.stats.totalSent = result.success ? 1 : 0;
    testCampaign.stats.totalFailed = result.success ? 0 : 1;
    await testCampaign.save();

    if (result.success) {
      res.json({
        success: true,
        message: `Test email sent successfully to ${testEmail}`,
        campaignId: testCampaign._id
      });
    } else {
      res.status(400).json({
        success: false,
        error: `Failed to send test email: ${result.error}`
      });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    console.error('Full error details:', error.stack);
    res.status(500).json({
      error: 'Failed to send test email',
      details: error.message
    });
  }
});

// POST /api/admin/email/send - Send email campaign
router.post('/send', [
  verifyToken,
  body('subject').notEmpty().withMessage('Subject is required'),
  body('targetAudience').isIn(['all', 'priceDrops', 'newMedications', 'promotions', 'weeklyDigest'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { subject, content, targetAudience } = req.body;

    // Create campaign
    const campaign = new EmailCampaign({
      subject,
      content,
      targetAudience,
      sentBy: req.user.id,
      status: 'draft'
    });

    await campaign.save();

    // Send campaign in background
    adminEmailService.sendCampaign(campaign._id)
      .then(result => {
        console.log(`Campaign ${campaign._id} sent successfully:`, result.results);
      })
      .catch(error => {
        console.error(`Campaign ${campaign._id} failed:`, error);
      });

    res.json({
      success: true,
      message: 'Email campaign queued for sending',
      campaignId: campaign._id,
      targetAudience,
      estimatedRecipients: await adminEmailService.getSubscriberCounts()[targetAudience] || 0
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create email campaign' });
  }
});

// GET /api/admin/email/campaigns - Get campaign history
router.get('/campaigns', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      EmailCampaign.find()
        .populate('sentBy', 'username email')
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      EmailCampaign.countDocuments()
    ]);

    res.json({
      campaigns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// GET /api/admin/email/campaigns/:id - Get specific campaign details
router.get('/campaigns/:id', verifyToken, async (req, res) => {
  try {
    const campaign = await EmailCampaign.findById(req.params.id)
      .populate('sentBy', 'username email')
      .lean();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

module.exports = router;