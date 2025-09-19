require('dotenv').config();
const mongoose = require('mongoose');
const Medication = require('../src/models/Medication');

async function checkMedicationDates() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get total count
    const total = await Medication.countDocuments();
    console.log(`\nTotal medications: ${total}`);

    // Check medications from last 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentMeds = await Medication.find({
      createdAt: { $gte: oneWeekAgo }
    }).select('name createdAt').limit(10);

    console.log(`\nMedications added in last 7 days: ${recentMeds.length}`);
    if (recentMeds.length > 0) {
      recentMeds.forEach(med => {
        console.log(`- ${med.name}: ${med.createdAt}`);
      });
    }

    // Check medications from last 30 days
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    const monthlyMeds = await Medication.countDocuments({
      createdAt: { $gte: oneMonthAgo }
    });
    console.log(`\nMedications added in last 30 days: ${monthlyMeds}`);

    // Get 5 most recent medications
    const mostRecent = await Medication.find()
      .sort({ createdAt: -1 })
      .select('name createdAt')
      .limit(5);

    console.log('\n5 Most recently added medications:');
    mostRecent.forEach(med => {
      const daysAgo = Math.floor((new Date() - med.createdAt) / (1000 * 60 * 60 * 24));
      console.log(`- ${med.name}: ${med.createdAt.toISOString()} (${daysAgo} days ago)`);
    });

    // Check if createdAt field exists for all
    const withoutCreatedAt = await Medication.countDocuments({
      createdAt: { $exists: false }
    });

    if (withoutCreatedAt > 0) {
      console.log(`\n⚠️  ${withoutCreatedAt} medications don't have createdAt field!`);
    }

    // Check if any have default date (might indicate migration issue)
    const defaultDate = await Medication.findOne().select('createdAt').sort({ createdAt: 1 });
    console.log(`\nOldest medication date: ${defaultDate?.createdAt}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

checkMedicationDates();