const EmailSubscription = require('../models/EmailSubscription');
const EmailCampaign = require('../models/EmailCampaign');
const Medication = require('../models/Medication');
const Price = require('../models/Price');
const Pharmacy = require('../models/Pharmacy');
const AdminMessage = require('../models/AdminMessage');
const emailService = require('./emailService');

class AdminEmailService {
  // Get data for new medications added this week
  async getNewMedicationsThisWeek() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const newMedications = await Medication.find({
      createdAt: { $gte: oneWeekAgo },
      $or: [{ isActive: true }, { isActive: { $exists: false } }]  // Include if isActive is true or doesn't exist
    }).limit(20).lean();

    // Get lowest price for each medication
    const medicationsWithPrices = [];
    for (const med of newMedications) {
      const lowestPrice = await Price.findOne({
        medicationId: med.id,  // Use med.id not med._id
        inStock: true,
        price: { $gt: 0 }
      }).sort({ price: 1 }).lean();

      if (lowestPrice) {
        const pharmacy = await Pharmacy.findOne({ id: lowestPrice.pharmacyId }).lean();
        medicationsWithPrices.push({
          medicationName: med.name,
          dosage: med.dosage,
          description: med.description,
          lowestPrice: lowestPrice.price,
          pharmacyName: pharmacy?.name || 'Unknown'
        });
      }
    }

    return medicationsWithPrices;
  }

  // Get price drops from the past week
  async getPriceDropsThisWeek() {
    // This would require the PriceHistory collection we discussed
    // For now, return empty array with a note
    console.log('Price drops tracking requires PriceHistory collection implementation');
    return [];

    /* Once PriceHistory is implemented:
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    return await PriceHistory.find({
      changeType: 'decrease',
      changedAt: { $gte: oneWeekAgo }
    }).sort({ priceChange: 1 }).limit(20).lean();
    */
  }

  // Get new promotions from admin messages this week
  async getPromotionsThisWeek() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const promotions = await AdminMessage.find({
      category: 'promo',
      createdAt: { $gte: oneWeekAgo },
      active: true
    }).populate('createdBy', 'username').limit(20).lean();

    return promotions.map(promo => ({
      title: promo.title,
      message: promo.message,
      medicationName: promo.medicationName,
      pharmacyName: promo.pharmacyName || 'All Pharmacies'
    }));
  }

  // Get subscriber counts by preference
  async getSubscriberCounts() {
    const allActive = await EmailSubscription.countDocuments({ status: 'active' });
    const priceDrops = await EmailSubscription.countDocuments({
      status: 'active',
      'preferences.priceDrops': true
    });
    const newMedications = await EmailSubscription.countDocuments({
      status: 'active',
      'preferences.newMedications': true
    });
    const promotions = await EmailSubscription.countDocuments({
      status: 'active',
      'preferences.promotions': true
    });
    const weeklyDigest = await EmailSubscription.countDocuments({
      status: 'active',
      'preferences.weeklyDigest': true
    });

    return {
      all: allActive,
      priceDrops,
      newMedications,
      promotions,
      weeklyDigest
    };
  }

  // Get email recipients based on target audience
  async getRecipients(targetAudience) {
    let query = { status: 'active' };

    switch (targetAudience) {
      case 'priceDrops':
        query['preferences.priceDrops'] = true;
        break;
      case 'newMedications':
        query['preferences.newMedications'] = true;
        break;
      case 'promotions':
        query['preferences.promotions'] = true;
        break;
      case 'weeklyDigest':
        query['preferences.weeklyDigest'] = true;
        break;
      case 'all':
        // No additional filter needed
        break;
      default:
        return [];
    }

    return await EmailSubscription.find(query).select('email unsubscribeToken').lean();
  }

  // Build email HTML content
  buildEmailContent(campaign) {
    if (!campaign.content) {
      console.error('Campaign content is undefined');
      return '<p>No content available</p>';
    }

    const { customText, includePriceDrops, includeNewMedications, includePromotions,
            priceDropsData, newMedicationsData, promotionsData } = campaign.content;

    let sections = [];

    // Custom text section
    if (customText) {
      sections.push(`
        <div style="margin-bottom: 30px;">
          <p style="color: #333; line-height: 1.6;">
            ${customText.replace(/\n/g, '<br>')}
          </p>
        </div>
      `);
    }

    // Price drops section
    if (includePriceDrops && priceDropsData?.length > 0) {
      sections.push(`
        <div style="margin-bottom: 30px;">
          <h2 style="color: #2c3e50; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
            🔻 Price Drops This Week
          </h2>
          ${priceDropsData.map(item => `
            <div style="background-color: #f9f9f9; padding: 15px; margin: 10px 0; border-radius: 8px;">
              <h3 style="color: #388e3c; margin: 0 0 5px 0;">${item.medicationName}</h3>
              ${item.dosage ? `<p style="color: #666; font-size: 14px; margin: 0;">Dosage: ${item.dosage}</p>` : ''}
              <p style="font-size: 16px; margin: 10px 0;">
                Was: <span style="text-decoration: line-through; color: #999;">£${item.oldPrice}</span>
                → Now: <strong style="color: #388e3c;">£${item.newPrice}</strong>
                <span style="color: #ff5252;">(-£${item.changeAmount})</span>
              </p>
              <p style="color: #666; font-size: 14px;">Available at: ${item.pharmacyName}</p>
            </div>
          `).join('')}
        </div>
      `);
    }

    // New medications section
    if (includeNewMedications && newMedicationsData?.length > 0) {
      sections.push(`
        <div style="margin-bottom: 30px;">
          <h2 style="color: #2c3e50; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
            ✨ New Medications Added
          </h2>
          ${newMedicationsData.map(item => `
            <div style="background-color: #f9f9f9; padding: 15px; margin: 10px 0; border-radius: 8px;">
              <h3 style="color: #388e3c; margin: 0 0 5px 0;">${item.medicationName}</h3>
              ${item.dosage ? `<p style="color: #666; font-size: 14px; margin: 0;">Dosage: ${Array.isArray(item.dosage) ? item.dosage.join(', ') : item.dosage}</p>` : ''}
              ${item.description ? `<p style="color: #666; font-size: 14px; margin: 10px 0;">${item.description}</p>` : ''}
              <p style="font-size: 16px; margin: 5px 0;">
                Starting from: <strong style="color: #388e3c;">£${item.lowestPrice}</strong>
              </p>
              <p style="color: #666; font-size: 14px;">Available at: ${item.pharmacyName}</p>
            </div>
          `).join('')}
        </div>
      `);
    }

    // Promotions section
    if (includePromotions && promotionsData?.length > 0) {
      sections.push(`
        <div style="margin-bottom: 30px;">
          <h2 style="color: #2c3e50; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
            🎁 Current Promotions
          </h2>
          ${promotionsData.map(item => `
            <div style="background-color: #fff3e0; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #ff9800;">
              <h3 style="color: #e65100; margin: 0 0 10px 0;">${item.title}</h3>
              <p style="color: #333; margin: 10px 0;">${item.message}</p>
              ${item.medicationName ? `<p style="color: #666; font-size: 14px;">Medication: ${item.medicationName}</p>` : ''}
              ${item.pharmacyName ? `<p style="color: #666; font-size: 14px;">At: ${item.pharmacyName}</p>` : ''}
            </div>
          `).join('')}
        </div>
      `);
    }

    return sections.join('');
  }

  // Send campaign email
  async sendCampaignEmail(campaign, recipient) {
    const unsubscribeLink = `https://pricemymeds.co.uk/unsubscribe?token=${recipient.unsubscribeToken}`;
    const content = this.buildEmailContent(campaign);

    const mailOptions = {
      from: `"PriceMyMeds" <${process.env.ZOHO_EMAIL}>`,
      to: recipient.email,
      subject: campaign.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background-color: #4CAF50; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">PriceMyMeds</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your Medication Price Tracker</p>
          </div>

          <!-- Main Content -->
          <div style="padding: 30px;">
            ${content}

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://pricemymeds.co.uk"
                 style="background-color: #4CAF50; color: white; padding: 12px 30px;
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Visit PriceMyMeds
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              You received this email because you subscribed to PriceMyMeds updates.
            </p>
            <p style="color: #666; font-size: 12px; margin: 10px 0 0 0;">
              <a href="${unsubscribeLink}" style="color: #4CAF50;">Unsubscribe</a>
            </p>
          </div>
        </div>
      `
    };

    try {
      // Check if transporter exists
      if (!emailService.transporter) {
        console.error('Email transporter not initialized');
        return { success: false, error: 'Email service not configured', email: recipient.email };
      }

      const info = await emailService.transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId, email: recipient.email };
    } catch (error) {
      console.error(`Error sending campaign email to ${recipient.email}:`, error);
      return { success: false, error: error.message, email: recipient.email };
    }
  }

  // Send test email
  async sendTestEmail(campaign, testEmail) {
    const testRecipient = {
      email: testEmail,
      unsubscribeToken: 'test-token'
    };

    // Convert to plain object if it's a Mongoose document
    const campaignObj = campaign.toObject ? campaign.toObject() : campaign;

    // Add [TEST] to subject
    const testCampaign = {
      ...campaignObj,
      subject: `[TEST] ${campaignObj.subject}`,
      content: campaignObj.content  // Ensure content is copied
    };

    return await this.sendCampaignEmail(testCampaign, testRecipient);
  }

  // Send campaign to all recipients
  async sendCampaign(campaignId) {
    const campaign = await EmailCampaign.findById(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Update status to sending
    campaign.status = 'sending';
    await campaign.save();

    try {
      // Get recipients based on target audience
      const recipients = await this.getRecipients(campaign.targetAudience);

      const results = {
        sent: [],
        failed: []
      };

      // Send emails in batches
      const batchSize = 5;
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);

        const batchResults = await Promise.all(
          batch.map(recipient => this.sendCampaignEmail(campaign, recipient))
        );

        batchResults.forEach(result => {
          const recipientEntry = {
            email: result.email,
            sentAt: new Date(),
            status: result.success ? 'sent' : 'failed',
            error: result.error
          };

          campaign.recipients.push(recipientEntry);

          if (result.success) {
            results.sent.push(result.email);
            campaign.stats.totalSent++;
          } else {
            results.failed.push({ email: result.email, error: result.error });
            campaign.stats.totalFailed++;
          }
        });

        // Save progress after each batch
        await campaign.save();

        // Add delay between batches
        if (i + batchSize < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Update final status
      campaign.status = 'sent';
      campaign.recipientCount = recipients.length;
      await campaign.save();

      // Update last email sent for subscribers
      if (results.sent.length > 0) {
        await EmailSubscription.updateMany(
          { email: { $in: results.sent } },
          {
            $set: { lastEmailSent: new Date() },
            $inc: { emailsSentCount: 1 }
          }
        );
      }

      return {
        success: true,
        campaign: campaign,
        results: results
      };
    } catch (error) {
      campaign.status = 'failed';
      await campaign.save();
      throw error;
    }
  }
}

module.exports = new AdminEmailService();