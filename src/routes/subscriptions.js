const express = require('express');
const router = express.Router();
const EmailSubscription = require('../models/EmailSubscription');
const { verifyToken, requireRole } = require('../middleware/auth');
const emailService = require('../services/emailService');

// Subscribe endpoint (public)
router.post('/subscribe', async (req, res) => {
  try {
    const { email, source = 'popup', preferences } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Check if email already exists
    let subscription = await EmailSubscription.findOne({ email: email.toLowerCase() });
    
    if (subscription) {
      if (subscription.status === 'active') {
        return res.status(400).json({ 
          message: 'This email is already subscribed to updates' 
        });
      } else if (subscription.status === 'unsubscribed') {
        // Reactivate subscription
        subscription.status = 'active';
        subscription.unsubscribedAt = null;
        if (preferences) {
          subscription.preferences = { ...subscription.preferences, ...preferences };
        }
        await subscription.save();
        
        return res.status(200).json({
          message: 'Welcome back! Your subscription has been reactivated.',
          subscription: {
            email: subscription.email,
            preferences: subscription.preferences
          }
        });
      }
    }
    
    // Create new subscription
    subscription = new EmailSubscription({
      email: email.toLowerCase(),
      source,
      subscribedTo: [{ type: 'all', value: null }],
      preferences: preferences || {
        priceDrops: true,
        newMedications: true,
        promotions: true,
        weeklyDigest: false
      }
    });
    
    await subscription.save();
    
    res.status(201).json({
      message: 'Successfully subscribed to price updates!',
      subscription: {
        email: subscription.email,
        preferences: subscription.preferences
      }
    });
  } catch (error) {
    console.error('Error subscribing:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'This email is already subscribed' 
      });
    }
    
    if (error.errors && error.errors.email) {
      return res.status(400).json({ 
        message: 'Please provide a valid email address' 
      });
    }
    
    res.status(500).json({ message: 'Error subscribing to updates' });
  }
});

// Unsubscribe endpoint (public)
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email, token } = req.body;
    
    let subscription;
    
    if (token) {
      subscription = await EmailSubscription.findOne({ 
        unsubscribeToken: token 
      });
    } else if (email) {
      subscription = await EmailSubscription.findOne({ 
        email: email.toLowerCase() 
      });
    } else {
      return res.status(400).json({ 
        message: 'Email or unsubscribe token is required' 
      });
    }
    
    if (!subscription) {
      return res.status(404).json({ 
        message: 'Subscription not found' 
      });
    }
    
    if (subscription.status === 'unsubscribed') {
      return res.status(200).json({ 
        message: 'You are already unsubscribed' 
      });
    }
    
    await subscription.unsubscribe();
    
    res.json({ 
      message: 'Successfully unsubscribed from all updates' 
    });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({ message: 'Error unsubscribing' });
  }
});

// Update preferences (public with email verification)
router.put('/preferences', async (req, res) => {
  try {
    const { email, preferences } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    const subscription = await EmailSubscription.findOne({ 
      email: email.toLowerCase(),
      status: 'active'
    });
    
    if (!subscription) {
      return res.status(404).json({ 
        message: 'Active subscription not found for this email' 
      });
    }
    
    subscription.preferences = { ...subscription.preferences, ...preferences };
    await subscription.save();
    
    res.json({
      message: 'Preferences updated successfully',
      preferences: subscription.preferences
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ message: 'Error updating preferences' });
  }
});

// Get all subscriptions (admin only)
router.get('/', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { status, source } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (source) filter.source = source;
    
    const subscriptions = await EmailSubscription.find(filter)
      .sort({ subscribedAt: -1 })
      .select('-unsubscribeToken');
    
    const stats = {
      total: await EmailSubscription.countDocuments(),
      active: await EmailSubscription.countDocuments({ status: 'active' }),
      unsubscribed: await EmailSubscription.countDocuments({ status: 'unsubscribed' }),
      bounced: await EmailSubscription.countDocuments({ status: 'bounced' })
    };
    
    res.json({
      subscriptions,
      stats
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ message: 'Error fetching subscriptions' });
  }
});

// Get subscription stats (admin only)
router.get('/stats', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const stats = {
      total: await EmailSubscription.countDocuments(),
      active: await EmailSubscription.countDocuments({ status: 'active' }),
      unsubscribed: await EmailSubscription.countDocuments({ status: 'unsubscribed' }),
      bounced: await EmailSubscription.countDocuments({ status: 'bounced' }),
      bySource: await EmailSubscription.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ]),
      recentSubscriptions: await EmailSubscription.find({ status: 'active' })
        .sort({ subscribedAt: -1 })
        .limit(10)
        .select('email subscribedAt source')
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching subscription stats:', error);
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

// Delete subscription (admin only)
router.delete('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const subscription = await EmailSubscription.findByIdAndDelete(id);
    
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    
    res.json({ message: 'Subscription deleted successfully' });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({ message: 'Error deleting subscription' });
  }
});

// Send newsletter to all active subscribers (admin only)
router.post('/send-newsletter', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { 
      subject, 
      heading, 
      content, 
      medications = [], 
      footer,
      testMode = false,
      testEmail 
    } = req.body;
    
    if (!content) {
      return res.status(400).json({ message: 'Newsletter content is required' });
    }
    
    let subscribers;
    
    if (testMode) {
      // Test mode: send only to specified email or admin email
      const email = testEmail || process.env.ADMIN_EMAIL || process.env.ZOHO_EMAIL;
      subscribers = [{
        email,
        unsubscribeToken: 'test-token'
      }];
      console.log(`Test mode: Sending newsletter to ${email}`);
    } else {
      // Production mode: send to all active subscribers
      subscribers = await EmailSubscription.find({ 
        status: 'active',
        'preferences.weeklyDigest': true 
      }).select('email unsubscribeToken');
      
      if (subscribers.length === 0) {
        return res.status(404).json({ 
          message: 'No active subscribers found with newsletter preference enabled' 
        });
      }
    }
    
    // Send newsletter
    const results = await emailService.sendBulkNewsletter(subscribers, {
      subject,
      heading,
      content,
      medications,
      footer
    });
    
    // Update last email sent for subscribers
    if (!testMode && results.sent.length > 0) {
      await EmailSubscription.updateMany(
        { email: { $in: results.sent } },
        { 
          $set: { lastEmailSent: new Date() },
          $inc: { emailsSentCount: 1 }
        }
      );
    }
    
    res.json({
      message: testMode ? 'Test newsletter sent successfully' : 'Newsletter sent successfully',
      results: {
        sent: results.sent.length,
        failed: results.failed.length,
        total: results.total,
        failedEmails: results.failed
      }
    });
    
  } catch (error) {
    console.error('Error sending newsletter:', error);
    res.status(500).json({ message: 'Error sending newsletter', error: error.message });
  }
});

// Send custom email to specific subscribers (admin only)
router.post('/send-custom-email', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { 
      emails, 
      subject, 
      heading, 
      content, 
      medications = [], 
      footer 
    } = req.body;
    
    if (!emails || emails.length === 0) {
      return res.status(400).json({ message: 'Email addresses are required' });
    }
    
    if (!content) {
      return res.status(400).json({ message: 'Email content is required' });
    }
    
    // Get subscriber details for the specified emails
    const subscribers = await EmailSubscription.find({ 
      email: { $in: emails },
      status: 'active'
    }).select('email unsubscribeToken');
    
    if (subscribers.length === 0) {
      return res.status(404).json({ 
        message: 'No active subscribers found with the specified email addresses' 
      });
    }
    
    // Send email
    const results = await emailService.sendBulkNewsletter(subscribers, {
      subject,
      heading,
      content,
      medications,
      footer
    });
    
    // Update last email sent
    if (results.sent.length > 0) {
      await EmailSubscription.updateMany(
        { email: { $in: results.sent } },
        { 
          $set: { lastEmailSent: new Date() },
          $inc: { emailsSentCount: 1 }
        }
      );
    }
    
    res.json({
      message: 'Custom email sent successfully',
      results: {
        sent: results.sent.length,
        failed: results.failed.length,
        total: results.total,
        failedEmails: results.failed
      }
    });
    
  } catch (error) {
    console.error('Error sending custom email:', error);
    res.status(500).json({ message: 'Error sending custom email', error: error.message });
  }
});

// Get email campaign history (admin only) - for future implementation
router.get('/campaigns', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    // This would fetch from a campaigns collection if you want to track sent newsletters
    res.json({
      message: 'Campaign history feature coming soon',
      campaigns: []
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ message: 'Error fetching campaigns' });
  }
});

module.exports = router;