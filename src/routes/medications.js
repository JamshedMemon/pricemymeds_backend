const express = require('express');
const router = express.Router();
const Medication = require('../models/Medication');
const Price = require('../models/Price');

// GET all medications (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { category, subcategory, search } = req.query;
    const filter = { active: true };
    
    if (category) filter.category = category;
    if (subcategory) filter.subcategory = subcategory;
    
    let query = Medication.find(filter);
    
    // Add text search if provided
    if (search) {
      query = query.or([
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { searchTerms: new RegExp(search, 'i') }
      ]);
    }
    
    const medications = await query
      .sort('name')
      .select('-__v');
    
    res.json(medications);
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({ message: 'Error fetching medications' });
  }
});

// GET medications by subcategory
router.get('/by-subcategory/:subcategoryId', async (req, res) => {
  try {
    const medications = await Medication.find({
      subcategory: req.params.subcategoryId,
      active: true
    })
    .sort('name')
    .select('-__v');
    
    res.json(medications);
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({ message: 'Error fetching medications' });
  }
});

// GET single medication with prices
router.get('/:medicationId', async (req, res) => {
  try {
    const medication = await Medication.findOne({
      id: req.params.medicationId,
      active: true
    }).select('-__v');
    
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }
    
    // Get all prices for this medication
    const prices = await Price.find({
      medicationId: medication.id,
      inStock: true
    })
    .sort('pharmacyId dosage price')
    .select('-__v');
    
    res.json({
      medication,
      prices
    });
  } catch (error) {
    console.error('Error fetching medication:', error);
    res.status(500).json({ message: 'Error fetching medication' });
  }
});

// GET price comparison for a medication
router.get('/:medicationId/comparison', async (req, res) => {
  try {
    const { dosage } = req.query;
    
    const medication = await Medication.findOne({
      id: req.params.medicationId,
      active: true
    });
    
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }
    
    // Build price query
    const priceQuery = {
      medicationId: req.params.medicationId
    };
    
    if (dosage) {
      priceQuery.dosage = dosage;
    }
    
    // Get prices with pharmacy details using aggregation
    const priceComparison = await Price.aggregate([
      { $match: priceQuery },
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
      {
        $group: {
          _id: {
            pharmacyId: '$pharmacyId',
            pharmacyName: '$pharmacy.name',
            pharmacyRating: '$pharmacy.rating',
            pharmacyWebsite: '$pharmacy.website'
          },
          prices: {
            $push: {
              dosage: '$dosage',
              price: '$price',
              quantity: '$quantity',
              inStock: '$inStock',
              link: '$link',
              lastUpdated: '$lastUpdated'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          pharmacy: {
            id: '$_id.pharmacyId',
            name: '$_id.pharmacyName',
            rating: '$_id.pharmacyRating',
            website: '$_id.pharmacyWebsite'
          },
          prices: 1
        }
      },
      { $sort: { 'pharmacy.rating': -1 } }
    ]);
    
    res.json({
      medication,
      comparison: priceComparison
    });
  } catch (error) {
    console.error('Error fetching price comparison:', error);
    res.status(500).json({ message: 'Error fetching price comparison' });
  }
});

// Search medications
router.get('/search/:query', async (req, res) => {
  try {
    const searchQuery = req.params.query;
    
    const medications = await Medication.find({
      $or: [
        { name: new RegExp(searchQuery, 'i') },
        { genericName: new RegExp(searchQuery, 'i') },
        { searchTerms: new RegExp(searchQuery, 'i') }
      ],
      active: true
    })
    .limit(20)
    .sort('name')
    .select('id name category subcategory dosage');
    
    res.json(medications);
  } catch (error) {
    console.error('Error searching medications:', error);
    res.status(500).json({ message: 'Error searching medications' });
  }
});

module.exports = router;