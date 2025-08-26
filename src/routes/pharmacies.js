const express = require('express');
const router = express.Router();
const Pharmacy = require('../models/Pharmacy');

// GET all active pharmacies
router.get('/', async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find({ active: true })
      .sort('-rating name')
      .select('-__v');
    
    res.json(pharmacies);
  } catch (error) {
    console.error('Error fetching pharmacies:', error);
    res.status(500).json({ message: 'Error fetching pharmacies' });
  }
});

// GET single pharmacy
router.get('/:pharmacyId', async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({
      id: req.params.pharmacyId,
      active: true
    }).select('-__v');
    
    if (!pharmacy) {
      return res.status(404).json({ message: 'Pharmacy not found' });
    }
    
    res.json(pharmacy);
  } catch (error) {
    console.error('Error fetching pharmacy:', error);
    res.status(500).json({ message: 'Error fetching pharmacy' });
  }
});

// GET top rated pharmacies
router.get('/top/rated', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const pharmacies = await Pharmacy.find({ 
      active: true,
      rating: { $gte: 4 }
    })
    .sort('-rating')
    .limit(limit)
    .select('id name rating website');
    
    res.json(pharmacies);
  } catch (error) {
    console.error('Error fetching top pharmacies:', error);
    res.status(500).json({ message: 'Error fetching top pharmacies' });
  }
});

module.exports = router;