const express = require('express');
const router = express.Router();
const Price = require('../models/Price');
const Medication = require('../models/Medication');
const Pharmacy = require('../models/Pharmacy');

// GET prices for a specific medication
router.get('/medication/:medicationId', async (req, res) => {
  try {
    const { dosage, sort = 'price' } = req.query;
    
    const query = {
      medicationId: req.params.medicationId,
      inStock: true
    };
    
    if (dosage) {
      query.dosage = dosage;
    }
    
    let sortOption = {};
    switch (sort) {
      case 'price':
        sortOption = { price: 1 };
        break;
      case 'price_desc':
        sortOption = { price: -1 };
        break;
      case 'rating':
        sortOption = { 'pharmacy.rating': -1, price: 1 };
        break;
      default:
        sortOption = { price: 1 };
    }
    
    // Use aggregation to join with pharmacy data
    const prices = await Price.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'pharmacies',
          let: { pharmacyId: '$pharmacyId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$id', '$$pharmacyId'] }
              }
            }
          ],
          as: 'pharmacy'
        }
      },
      { $unwind: '$pharmacy' },
      { $sort: sortOption },
      {
        $project: {
          __v: 0,
          'pharmacy.__v': 0
        }
      }
    ]);
    
    res.json(prices);
  } catch (error) {
    console.error('Error fetching prices:', error);
    res.status(500).json({ message: 'Error fetching prices' });
  }
});

// GET lowest price for a medication/dosage
router.get('/lowest/:medicationId', async (req, res) => {
  try {
    const { dosage } = req.query;
    
    const query = {
      medicationId: req.params.medicationId,
      inStock: true
    };
    
    if (dosage) {
      query.dosage = dosage;
    }
    
    const lowestPrice = await Price.findOne(query)
      .sort('price')
      .populate('pharmacy', 'id name rating website');
    
    if (!lowestPrice) {
      return res.status(404).json({ message: 'No prices found' });
    }
    
    res.json(lowestPrice);
  } catch (error) {
    console.error('Error fetching lowest price:', error);
    res.status(500).json({ message: 'Error fetching lowest price' });
  }
});

// GET price matrix for comparison page
router.get('/matrix/:subcategory', async (req, res) => {
  try {
    // Get all medications in subcategory
    const medications = await Medication.find({
      subcategory: req.params.subcategory,
      active: true
    }).select('id name dosage');
    
    if (!medications.length) {
      return res.json({ medications: [], pharmacies: [], matrix: [] });
    }
    
    const medicationIds = medications.map(m => m.id);
    
    // Get all prices for these medications
    const prices = await Price.find({
      medicationId: { $in: medicationIds },
      inStock: true
    });
    
    // Get unique pharmacies
    const pharmacyIds = [...new Set(prices.map(p => p.pharmacyId))];
    const pharmacies = await Pharmacy.find({
      id: { $in: pharmacyIds },
      active: true
    }).select('id name rating website');
    
    // Build price matrix
    const matrix = {};
    prices.forEach(price => {
      const key = `${price.medicationId}:${price.pharmacyId}:${price.dosage}`;
      matrix[key] = {
        price: price.price,
        link: price.link,
        lastUpdated: price.lastUpdated
      };
    });
    
    res.json({
      medications,
      pharmacies,
      matrix
    });
  } catch (error) {
    console.error('Error fetching price matrix:', error);
    res.status(500).json({ message: 'Error fetching price matrix' });
  }
});

// GET recent price updates
router.get('/recent-updates', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const since = req.query.since ? new Date(req.query.since) : 
                  new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours
    
    const recentPrices = await Price.aggregate([
      {
        $match: {
          lastUpdated: { $gte: since }
        }
      },
      { $sort: { lastUpdated: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'medications',
          let: { medId: '$medicationId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$id', '$$medId'] }
              }
            }
          ],
          as: 'medication'
        }
      },
      {
        $lookup: {
          from: 'pharmacies',
          let: { pharmId: '$pharmacyId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$id', '$$pharmId'] }
              }
            }
          ],
          as: 'pharmacy'
        }
      },
      { $unwind: '$medication' },
      { $unwind: '$pharmacy' },
      {
        $project: {
          price: 1,
          dosage: 1,
          lastUpdated: 1,
          'medication.name': 1,
          'pharmacy.name': 1
        }
      }
    ]);
    
    res.json(recentPrices);
  } catch (error) {
    console.error('Error fetching recent updates:', error);
    res.status(500).json({ message: 'Error fetching recent updates' });
  }
});

module.exports = router;