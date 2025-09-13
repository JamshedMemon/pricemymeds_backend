const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    // Check if email credentials are configured
    if (!process.env.ZOHO_EMAIL || !process.env.ZOHO_APP_PASSWORD) {
      console.warn('⚠️  Email credentials not configured. Email service disabled.');
      console.log('   Please set ZOHO_EMAIL and ZOHO_APP_PASSWORD in .env file');
      return;
    }

    // Determine SMTP host based on region
    // Try different regions: .com (US), .eu (Europe), .in (India), .com.au (Australia)
    const smtpHost = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.eu';
    
    console.log('📧 Configuring email service:');
    console.log(`   Host: ${smtpHost}`);
    console.log(`   User: ${process.env.ZOHO_EMAIL}`);
    console.log(`   Pass: ${process.env.ZOHO_APP_PASSWORD.substring(0, 4)}****`);
    
    // Zoho Mail SMTP Configuration
    // Try port 587 if 465 doesn't work
    const usePort587 = process.env.ZOHO_USE_PORT_587 === 'true';
    
    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: usePort587 ? 587 : 465,
      secure: !usePort587, // true for 465, false for 587
      auth: {
        user: process.env.ZOHO_EMAIL,
        pass: process.env.ZOHO_APP_PASSWORD
      },
      tls: {
        rejectUnauthorized: false // Sometimes needed for Zoho
      },
      debug: process.env.NODE_ENV === 'development', // Enable debug in dev mode
      logger: process.env.NODE_ENV === 'development' // Enable logging in dev mode
    });

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('❌ Email service error:', error.message);
        console.log('\n📝 Troubleshooting steps:');
        console.log('1. Ensure 2FA is enabled for your Zoho account');
        console.log('2. Generate app-specific password at: https://accounts.zoho.eu/home#security/security_pwd');
        console.log('3. Try different SMTP hosts:');
        console.log('   - smtp.zoho.com (US)');
        console.log('   - smtp.zoho.eu (Europe)');
        console.log('   - smtp.zoho.in (India)');
        console.log('   - smtp.zoho.com.au (Australia)');
        console.log('4. Set ZOHO_SMTP_HOST in .env if not using .eu region');
      } else {
        console.log('✅ Email service ready');
      }
    });
  }

  async sendContactFormEmail(contactData) {
    const { name, email, subject, message } = contactData;
    
    const mailOptions = {
      from: `"PriceMyMeds Contact Form" <${process.env.ZOHO_EMAIL}>`,
      to: process.env.ADMIN_EMAIL || process.env.ZOHO_EMAIL,
      replyTo: email,
      subject: `Contact Form: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Contact Form Submission</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong></p>
            <div style="background-color: white; padding: 15px; border-radius: 3px;">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This email was sent from the PriceMyMeds contact form.
          </p>
        </div>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Contact form email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending contact form email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPriceAlertEmail(alertData, currentPrice) {
    const { email, medicationName, dosage, targetPrice, lowestPharmacy } = alertData;
    
    const mailOptions = {
      from: `"PriceMyMeds Alerts" <${process.env.ZOHO_EMAIL}>`,
      to: email,
      subject: `Price Alert: ${medicationName} is now £${currentPrice}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2c3e50; text-align: center;">Price Drop Alert! 🎉</h1>
          
          <div style="background-color: #e8f5e9; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h2 style="color: #388e3c; margin: 0;">${medicationName}</h2>
            ${dosage ? `<p style="color: #666; margin: 5px 0;">Dosage: ${dosage}</p>` : ''}
            
            <div style="margin-top: 15px;">
              <p style="font-size: 16px; margin: 5px 0;">
                <strong>Your target price:</strong> £${targetPrice}
              </p>
              <p style="font-size: 20px; color: #388e3c; margin: 5px 0;">
                <strong>Current price:</strong> £${currentPrice}
              </p>
              ${lowestPharmacy ? `
                <p style="font-size: 14px; color: #666; margin-top: 10px;">
                  Available at: <strong>${lowestPharmacy.name}</strong>
                </p>
              ` : ''}
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://pricemymeds.co.uk" 
               style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              View on PriceMyMeds
            </a>
          </div>
          
          <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
            You received this email because you set up a price alert on PriceMyMeds.
            <br>
            To stop receiving these alerts, please visit our website.
          </p>
        </div>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Price alert email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending price alert email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendTestEmail() {
    const mailOptions = {
      from: `"PriceMyMeds" <${process.env.ZOHO_EMAIL}>`,
      to: process.env.ADMIN_EMAIL || process.env.ZOHO_EMAIL,
      subject: 'Test Email - PriceMyMeds Email Service',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Email Service Test</h2>
          <p>This is a test email to confirm that the email service is working correctly.</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        </div>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Test email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending test email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendNewsletter(subscriber, newsletterContent) {
    const { subject, heading, content, medications = [], footer } = newsletterContent;
    
    // Generate unsubscribe link
    const unsubscribeLink = `https://pricemymeds.co.uk/unsubscribe?token=${subscriber.unsubscribeToken}`;
    
    // Build medications list HTML if provided
    let medicationsHtml = '';
    if (medications.length > 0) {
      medicationsHtml = `
        <div style="margin: 30px 0;">
          <h3 style="color: #2c3e50; margin-bottom: 15px;">Featured Medications & Prices</h3>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px;">
            ${medications.map(med => `
              <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e0e0e0;">
                <h4 style="color: #388e3c; margin: 0 0 5px 0;">${med.name}</h4>
                ${med.dosage ? `<p style="color: #666; font-size: 14px; margin: 0;">Dosage: ${med.dosage}</p>` : ''}
                <p style="font-size: 16px; margin: 5px 0;">
                  <strong>From £${med.price}</strong>
                  ${med.pharmacy ? ` at ${med.pharmacy}` : ''}
                </p>
                ${med.description ? `<p style="color: #666; font-size: 14px; margin: 5px 0;">${med.description}</p>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    const mailOptions = {
      from: `"PriceMyMeds Newsletter" <${process.env.ZOHO_EMAIL}>`,
      to: subscriber.email,
      subject: subject || 'PriceMyMeds Newsletter',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background-color: #4CAF50; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">PriceMyMeds</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your Medication Price Tracker</p>
          </div>
          
          <!-- Main Content -->
          <div style="padding: 30px;">
            <h2 style="color: #2c3e50; margin-bottom: 20px;">${heading || 'Newsletter Update'}</h2>
            
            <div style="color: #333; line-height: 1.6;">
              ${content.replace(/\n/g, '<br>')}
            </div>
            
            ${medicationsHtml}
            
            ${footer ? `
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <p style="color: #666; font-size: 14px;">${footer}</p>
              </div>
            ` : ''}
            
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
              <a href="${unsubscribeLink}" style="color: #4CAF50;">Unsubscribe</a> | 
              <a href="https://pricemymeds.co.uk/preferences?email=${subscriber.email}" style="color: #4CAF50;">Update Preferences</a>
            </p>
          </div>
        </div>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId, email: subscriber.email };
    } catch (error) {
      console.error(`Error sending newsletter to ${subscriber.email}:`, error);
      return { success: false, error: error.message, email: subscriber.email };
    }
  }

  async sendBulkNewsletter(subscribers, newsletterContent) {
    console.log(`Sending newsletter to ${subscribers.length} subscribers...`);
    
    const results = {
      sent: [],
      failed: [],
      total: subscribers.length
    };
    
    // Send emails in batches to avoid overwhelming the server
    const batchSize = 10;
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      
      // Send batch in parallel
      const batchResults = await Promise.all(
        batch.map(subscriber => this.sendNewsletter(subscriber, newsletterContent))
      );
      
      // Categorize results
      batchResults.forEach(result => {
        if (result.success) {
          results.sent.push(result.email);
        } else {
          results.failed.push({ email: result.email, error: result.error });
        }
      });
      
      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < subscribers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }
    
    console.log(`Newsletter sent: ${results.sent.length} successful, ${results.failed.length} failed`);
    return results;
  }
}

module.exports = new EmailService();