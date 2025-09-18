const cron = require('node-cron');
const PriceAlert = require('../models/PriceAlert');
const Price = require('../models/Price');
const Pharmacy = require('../models/Pharmacy');
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
            ...(alert.dosage && { dosage: alert.dosage }),
            inStock: true,  // Only consider in-stock items
            price: { $gt: 0 }  // Ensure price is greater than 0
          }).sort({ price: 1 });

          if (!lowestPrice) {
            console.log(`No valid price found for medication ${alert.medicationId} (${alert.medicationName}) with dosage: ${alert.dosage || 'any'}`);
            continue;
          }

          // Validate price data
          if (!lowestPrice.price || lowestPrice.price <= 0) {
            console.log(`Invalid price (${lowestPrice.price}) found for alert ${alert._id}, skipping...`);
            continue;
          }

          // Get pharmacy details separately since populate doesn't work with string IDs
          const pharmacy = await Pharmacy.findOne({ id: lowestPrice.pharmacyId });

          const currentPrice = lowestPrice.price;
          console.log(`Checking alert for ${alert.medicationName}: Target £${alert.targetPrice}, Current £${currentPrice}, Pharmacy: ${pharmacy?.name || 'Unknown'}`);

          // Check if price has dropped to or below target (with additional validation)
          if (currentPrice > 0 && currentPrice <= alert.targetPrice) {
            console.log(`Price alert triggered for ${alert.email} - ${alert.medicationName} at £${currentPrice}`);

            // Send email notification
            const emailResult = await emailService.sendPriceAlertEmail(
              {
                email: alert.email,
                medicationName: alert.medicationName,
                dosage: alert.dosage,
                targetPrice: alert.targetPrice,
                lowestPharmacy: pharmacy ? {
                  name: pharmacy.name,
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
            if (pharmacy) {
              alert.lowestPharmacy = {
                name: pharmacy.name,
                price: currentPrice
              };
            }
            await alert.save();
            console.log(`Alert not triggered for ${alert.medicationName}: Current £${currentPrice} > Target £${alert.targetPrice}`);
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