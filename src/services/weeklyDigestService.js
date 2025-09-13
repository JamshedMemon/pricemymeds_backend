const cron = require('node-cron');
const EmailSubscription = require('../models/EmailSubscription');
const Medication = require('../models/Medication');
const Price = require('../models/Price');
const emailService = require('./emailService');

class WeeklyDigestService {
  constructor() {
    this.isRunning = false;
  }

  // Get top medications with lowest prices for the digest
  async getTopMedications(limit = 5) {
    try {
      // Get medications with recent price updates
      const medications = await Medication.find({ isActive: true })
        .limit(limit * 2) // Get more to filter
        .lean();
      
      const medicationsWithPrices = [];
      
      for (const med of medications) {
        const lowestPrice = await Price.findOne({ 
          medicationId: med._id.toString() 
        })
        .sort({ price: 1 })
        .populate('pharmacyId')
        .lean();
        
        if (lowestPrice) {
          medicationsWithPrices.push({
            name: med.name,
            dosage: med.dosage,
            price: lowestPrice.price,
            pharmacy: lowestPrice.pharmacyId?.name,
            description: med.description
          });
        }
      }
      
      // Return top medications sorted by price
      return medicationsWithPrices
        .sort((a, b) => a.price - b.price)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting top medications:', error);
      return [];
    }
  }

  // Send weekly digest to all subscribers
  async sendWeeklyDigest() {
    if (this.isRunning) {
      console.log('Weekly digest already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('Starting weekly digest...', new Date().toISOString());

    try {
      // Get all active subscribers who want weekly digest
      const subscribers = await EmailSubscription.find({
        status: 'active',
        'preferences.weeklyDigest': true
      }).select('email unsubscribeToken');

      if (subscribers.length === 0) {
        console.log('No subscribers for weekly digest');
        return;
      }

      console.log(`Sending weekly digest to ${subscribers.length} subscribers`);

      // Get top medications for the digest
      const topMedications = await this.getTopMedications(5);

      // Prepare newsletter content
      const newsletterContent = {
        subject: 'Your PriceMyMeds Weekly Digest',
        heading: 'Weekly Price Updates',
        content: `Here are this week's best medication prices and updates from PriceMyMeds.
        
We've scanned multiple pharmacies to bring you the best deals on essential medications.
        
Check out our featured medications below with the lowest prices we've found this week.`,
        medications: topMedications,
        footer: 'Thank you for trusting PriceMyMeds to help you find the best medication prices. Visit our website for more deals and to set up price alerts for your medications.'
      };

      // Send digest
      const results = await emailService.sendBulkNewsletter(subscribers, newsletterContent);

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

      console.log(`Weekly digest completed: ${results.sent.length} sent, ${results.failed.length} failed`);
      
      return results;
    } catch (error) {
      console.error('Error sending weekly digest:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Start the weekly digest cron job
  startCronJob() {
    // Default: Every Sunday at 9:00 AM
    // Cron format: minute hour day-of-month month day-of-week
    const schedule = process.env.WEEKLY_DIGEST_CRON || '0 9 * * 0';
    
    console.log(`Starting weekly digest cron job with schedule: ${schedule}`);
    
    cron.schedule(schedule, async () => {
      await this.sendWeeklyDigest();
    });

    // Log next scheduled run
    console.log('Weekly digest scheduled for Sundays at 9:00 AM');
  }

  // Manual trigger for testing
  async testWeeklyDigest(testEmail) {
    console.log('Manually triggering weekly digest test...');
    
    try {
      // Get top medications
      const topMedications = await this.getTopMedications(5);
      
      // Create test subscriber
      const testSubscriber = {
        email: testEmail || process.env.ADMIN_EMAIL || process.env.ZOHO_EMAIL,
        unsubscribeToken: 'test-token'
      };
      
      // Prepare newsletter content
      const newsletterContent = {
        subject: '[TEST] Your PriceMyMeds Weekly Digest',
        heading: 'Weekly Price Updates (Test)',
        content: `This is a test of the weekly digest email.
        
Here are this week's best medication prices and updates from PriceMyMeds.
        
Check out our featured medications below with the lowest prices we've found this week.`,
        medications: topMedications,
        footer: 'This is a test email. Thank you for using PriceMyMeds.'
      };
      
      // Send test digest
      const result = await emailService.sendNewsletter(testSubscriber, newsletterContent);
      
      console.log('Test weekly digest sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending test weekly digest:', error);
      throw error;
    }
  }
}

module.exports = new WeeklyDigestService();