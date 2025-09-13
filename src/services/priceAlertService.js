const cron = require('node-cron');
const PriceAlert = require('../models/PriceAlert');
const Price = require('../models/Price');
const emailService = require('./emailService');

class PriceAlertService {
  constructor() {
    this.isRunning = false;
  }

  // Check all active price alerts
  async checkPriceAlerts() {
    if (this.isRunning) {
      console.log('Price alert check already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('Starting price alert check...', new Date().toISOString());

    try {
      // Get all active alerts
      const activeAlerts = await PriceAlert.find({
        status: 'active',
        expiresAt: { $gt: new Date() }
      });

      console.log(`Found ${activeAlerts.length} active price alerts to check`);

      for (const alert of activeAlerts) {
        try {
          // Get current lowest price for the medication
          const lowestPrice = await Price.findOne({
            medicationId: alert.medicationId,
            ...(alert.dosage && { dosage: alert.dosage })
          }).sort({ price: 1 }).populate('pharmacyId');

          if (!lowestPrice) {
            console.log(`No price found for medication ${alert.medicationId}`);
            continue;
          }

          const currentPrice = lowestPrice.price;
          console.log(`Checking alert for ${alert.medicationName}: Target £${alert.targetPrice}, Current £${currentPrice}`);

          // Check if price has dropped to or below target
          if (currentPrice <= alert.targetPrice) {
            console.log(`Price alert triggered for ${alert.email} - ${alert.medicationName}`);

            // Send email notification
            const emailResult = await emailService.sendPriceAlertEmail(
              {
                email: alert.email,
                medicationName: alert.medicationName,
                dosage: alert.dosage,
                targetPrice: alert.targetPrice,
                lowestPharmacy: lowestPrice.pharmacyId ? {
                  name: lowestPrice.pharmacyId.name,
                  price: currentPrice
                } : null
              },
              currentPrice
            );

            if (emailResult.success) {
              // Update alert status to triggered
              alert.status = 'triggered';
              alert.triggeredAt = new Date();
              await alert.save();
              console.log(`Alert marked as triggered for ${alert.email}`);
            } else {
              console.error(`Failed to send email for alert ${alert._id}:`, emailResult.error);
            }
          } else {
            // Update current price for reference
            alert.currentPrice = currentPrice;
            if (lowestPrice.pharmacyId) {
              alert.lowestPharmacy = {
                name: lowestPrice.pharmacyId.name,
                price: currentPrice
              };
            }
            await alert.save();
          }
        } catch (error) {
          console.error(`Error processing alert ${alert._id}:`, error);
        }
      }

      // Clean up expired alerts
      const expiredCount = await PriceAlert.updateMany(
        {
          status: 'active',
          expiresAt: { $lte: new Date() }
        },
        {
          $set: { status: 'expired' }
        }
      );

      if (expiredCount.modifiedCount > 0) {
        console.log(`Marked ${expiredCount.modifiedCount} alerts as expired`);
      }

    } catch (error) {
      console.error('Error in price alert check:', error);
    } finally {
      this.isRunning = false;
      console.log('Price alert check completed');
    }
  }

  // Start the cron job
  startCronJob() {
    // Run every hour at minute 0
    // '0 * * * *' = At minute 0 of every hour
    const schedule = process.env.PRICE_ALERT_CRON || '0 * * * *';
    
    console.log(`Starting price alert cron job with schedule: ${schedule}`);
    
    cron.schedule(schedule, async () => {
      await this.checkPriceAlerts();
    });

    // Also run immediately on startup in production
    if (process.env.NODE_ENV === 'production') {
      setTimeout(() => {
        this.checkPriceAlerts();
      }, 5000); // Wait 5 seconds for server to fully initialize
    }
  }

  // Manual trigger for testing
  async testPriceAlerts() {
    console.log('Manually triggering price alert check...');
    await this.checkPriceAlerts();
  }
}

module.exports = new PriceAlertService();