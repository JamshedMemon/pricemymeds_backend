const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { verifyToken, requireRole } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');
const Category = require('../models/Category');
const Medication = require('../models/Medication');
const Pharmacy = require('../models/Pharmacy');
const Price = require('../models/Price');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// Apply authentication to all admin routes
router.use(verifyToken);
router.use(requireRole(['admin', 'editor']));

// ===== MEDICATION MANAGEMENT =====

// GET all medications (with pagination)
router.get('/medications', async (req, res) => {
  try {
    const { page = 1, limit = 50, category, subcategory, search } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (category) filter.category = category;
    if (subcategory) filter.subcategory = subcategory;
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }
    
    const [medications, total] = await Promise.all([
      Medication.find(filter)
        .skip(skip)
        .limit(parseInt(limit))
        .sort('name'),
      Medication.countDocuments(filter)
    ]);
    
    res.json({
      medications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({ message: 'Error fetching medications' });
  }
});

// GET single medication with prices
router.get('/medications/:medicationId', async (req, res) => {
  try {
    const medication = await Medication.findOne({ id: req.params.medicationId });
    
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }
    
    const [prices, pharmacies] = await Promise.all([
      Price.find({ medicationId: req.params.medicationId }),
      Pharmacy.find({ active: true }).sort('name')
    ]);
    
    res.json({
      medication,
      prices,
      pharmacies
    });
  } catch (error) {
    console.error('Error fetching medication details:', error);
    res.status(500).json({ message: 'Error fetching medication details' });
  }
});

// POST create new medication
router.post('/medications', requireRole('admin'), [
  body('name').notEmpty().trim(),
  body('category').notEmpty(),
  body('subcategory').notEmpty(),
  body('dosage').isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const medicationData = req.body;
    // Generate URL-safe ID handling special characters
    medicationData.id = medicationData.name.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/%/g, 'pct')
      .replace(/\//g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    const medication = new Medication(medicationData);
    await medication.save();
    
    await logAction(req, 'medication_create', 'medication', medication.id, medicationData);
    
    res.status(201).json(medication);
  } catch (error) {
    console.error('Error creating medication:', error);
    res.status(500).json({ message: 'Error creating medication' });
  }
});

// PUT update medication
router.put('/medications/:medicationId', [
  body('name').optional().trim(),
  body('dosage').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const medication = await Medication.findOneAndUpdate(
      { id: req.params.medicationId },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }
    
    await logAction(req, 'medication_update', 'medication', medication.id, req.body);
    
    res.json(medication);
  } catch (error) {
    console.error('Error updating medication:', error);
    res.status(500).json({ message: 'Error updating medication' });
  }
});

// DELETE medication (soft delete)
router.delete('/medications/:medicationId', requireRole('admin'), async (req, res) => {
  try {
    const medication = await Medication.findOneAndUpdate(
      { id: req.params.medicationId },
      { active: false, updatedAt: new Date() },
      { new: true }
    );
    
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }
    
    await logAction(req, 'medication_delete', 'medication', medication.id, {});
    
    res.json({ message: 'Medication deleted successfully' });
  } catch (error) {
    console.error('Error deleting medication:', error);
    res.status(500).json({ message: 'Error deleting medication' });
  }
});

// ===== PRICE MANAGEMENT =====

// POST bulk update prices
router.post('/prices/bulk', [
  body('prices').isArray(),
  body('prices.*.medicationId').notEmpty(),
  body('prices.*.pharmacyId').notEmpty(),
  body('prices.*.dosage').notEmpty(),
  body('prices.*.price').isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { prices } = req.body;
    
    // Prepare bulk operations
    const bulkOps = prices.map(price => ({
      updateOne: {
        filter: {
          medicationId: price.medicationId,
          pharmacyId: price.pharmacyId,
          dosage: price.dosage
        },
        update: {
          $set: {
            ...price,
            lastUpdated: new Date(),
            source: 'manual'
          }
        },
        upsert: true
      }
    }));
    
    const result = await Price.bulkWrite(bulkOps);
    
    await logAction(req, 'price_bulk_update', 'prices', null, {
      count: prices.length,
      modified: result.modifiedCount,
      upserted: result.upsertedCount
    });
    
    res.json({
      success: true,
      modified: result.modifiedCount,
      upserted: result.upsertedCount
    });
  } catch (error) {
    console.error('Error bulk updating prices:', error);
    res.status(500).json({ message: 'Error updating prices' });
  }
});

// PUT update single price
router.put('/prices/:priceId', [
  body('price').optional().isNumeric(),
  body('inStock').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const price = await Price.findByIdAndUpdate(
      req.params.priceId,
      { 
        ...req.body, 
        lastUpdated: new Date(),
        source: 'manual'
      },
      { new: true }
    );
    
    if (!price) {
      return res.status(404).json({ message: 'Price not found' });
    }
    
    await logAction(req, 'price_update', 'price', price._id, req.body);
    
    res.json(price);
  } catch (error) {
    console.error('Error updating price:', error);
    res.status(500).json({ message: 'Error updating price' });
  }
});

// DELETE single price
router.delete('/prices/:priceId', async (req, res) => {
  try {
    const price = await Price.findByIdAndDelete(req.params.priceId);
    
    if (!price) {
      return res.status(404).json({ message: 'Price not found' });
    }
    
    await logAction(req, 'price_delete', 'price', price._id, {});
    
    res.json({ message: 'Price deleted successfully' });
  } catch (error) {
    console.error('Error deleting price:', error);
    res.status(500).json({ message: 'Error deleting price' });
  }
});

// GET price grid for medication
router.get('/prices/grid/:medicationId', async (req, res) => {
  try {
    const medication = await Medication.findOne({ id: req.params.medicationId });
    if (!medication) {
      return res.status(404).json({ message: 'Medication not found' });
    }
    
    const [prices, pharmacies] = await Promise.all([
      Price.find({ medicationId: req.params.medicationId }),
      Pharmacy.find({ active: true }).sort('name')
    ]);
    
    // Build grid structure
    const grid = {};
    prices.forEach(price => {
      const key = `${price.pharmacyId}:${price.dosage}`;
      grid[key] = {
        price: price.price,
        inStock: price.inStock,
        link: price.link,
        lastUpdated: price.lastUpdated,
        _id: price._id
      };
    });
    
    res.json({
      medication,
      pharmacies,
      grid,
      dosages: medication.dosage
    });
  } catch (error) {
    console.error('Error fetching price grid:', error);
    res.status(500).json({ message: 'Error fetching price grid' });
  }
});

// ===== PHARMACY MANAGEMENT =====

// GET all pharmacies
router.get('/pharmacies', async (req, res) => {
  try {
    const pharmacies = await Pharmacy.find().sort('name');
    res.json(pharmacies);
  } catch (error) {
    console.error('Error fetching pharmacies:', error);
    res.status(500).json({ message: 'Error fetching pharmacies' });
  }
});

// GET single pharmacy
router.get('/pharmacies/:pharmacyId', async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ id: req.params.pharmacyId });
    
    if (!pharmacy) {
      return res.status(404).json({ message: 'Pharmacy not found' });
    }
    
    res.json(pharmacy);
  } catch (error) {
    console.error('Error fetching pharmacy:', error);
    res.status(500).json({ message: 'Error fetching pharmacy' });
  }
});

// POST create pharmacy
router.post('/pharmacies', requireRole('admin'), [
  body('name').notEmpty().trim(),
  body('website').isURL(),
  body('rating').optional().isFloat({ min: 0, max: 5 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const pharmacyData = req.body;
    pharmacyData.id = pharmacyData.name.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    const pharmacy = new Pharmacy(pharmacyData);
    await pharmacy.save();
    
    await logAction(req, 'pharmacy_create', 'pharmacy', pharmacy.id, pharmacyData);
    
    res.status(201).json(pharmacy);
  } catch (error) {
    console.error('Error creating pharmacy:', error);
    res.status(500).json({ message: 'Error creating pharmacy' });
  }
});

// PUT update pharmacy
router.put('/pharmacies/:pharmacyId', async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOneAndUpdate(
      { id: req.params.pharmacyId },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    
    if (!pharmacy) {
      return res.status(404).json({ message: 'Pharmacy not found' });
    }
    
    await logAction(req, 'pharmacy_update', 'pharmacy', pharmacy.id, req.body);
    
    res.json(pharmacy);
  } catch (error) {
    console.error('Error updating pharmacy:', error);
    res.status(500).json({ message: 'Error updating pharmacy' });
  }
});

// DELETE pharmacy
router.delete('/pharmacies/:pharmacyId', requireRole('admin'), async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOneAndDelete({ id: req.params.pharmacyId });
    
    if (!pharmacy) {
      return res.status(404).json({ message: 'Pharmacy not found' });
    }
    
    // Also delete all prices associated with this pharmacy
    await Price.deleteMany({ pharmacyId: req.params.pharmacyId });
    
    await logAction(req, 'pharmacy_delete', 'pharmacy', pharmacy.id, {});
    
    res.json({ message: 'Pharmacy deleted successfully' });
  } catch (error) {
    console.error('Error deleting pharmacy:', error);
    res.status(500).json({ message: 'Error deleting pharmacy' });
  }
});

// ===== CATEGORY MANAGEMENT =====

// POST create/update category
router.post('/categories', requireRole('admin'), [
  body('id').notEmpty(),
  body('name').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const category = await Category.findOneAndUpdate(
      { id: req.body.id },
      { ...req.body, updatedAt: new Date() },
      { new: true, upsert: true }
    );
    
    await logAction(req, 'category_update', 'category', category.id, req.body);
    
    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Error updating category' });
  }
});

// ===== USER MANAGEMENT =====

// GET all users (admin only)
router.get('/users', requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// PUT update user
router.put('/users/:userId', requireRole('admin'), async (req, res) => {
  try {
    const { password, ...updateData } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user' });
  }
});

// ===== AUDIT LOGS =====

// GET audit logs
router.get('/audit-logs', requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, action, userId } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (action) filter.action = action;
    if (userId) filter.user = userId;
    
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('user', 'name email')
        .skip(skip)
        .limit(parseInt(limit))
        .sort('-timestamp'),
      AuditLog.countDocuments(filter)
    ]);
    
    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Error fetching audit logs' });
  }
});

// ===== DASHBOARD STATS =====

// GET dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const [
      totalMedications,
      totalPharmacies,
      totalPrices,
      recentUpdates,
      missingPrices
    ] = await Promise.all([
      Medication.countDocuments({ active: true }),
      Pharmacy.countDocuments({ active: true }),
      Price.countDocuments(),
      Price.countDocuments({
        lastUpdated: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }),
      // Count medication-dosage combinations without prices
      Medication.aggregate([
        { $match: { active: true } },
        { $unwind: '$dosage' },
        {
          $lookup: {
            from: 'prices',
            let: { medId: '$id', dos: '$dosage' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$medicationId', '$$medId'] },
                      { $eq: ['$dosage', '$$dos'] }
                    ]
                  }
                }
              }
            ],
            as: 'prices'
          }
        },
        { $match: { prices: { $size: 0 } } },
        { $count: 'missing' }
      ])
    ]);
    
    res.json({
      totalMedications,
      totalPharmacies,
      totalPrices,
      recentUpdates,
      missingPrices: missingPrices[0]?.missing || 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Error fetching statistics' });
  }
});

module.exports = router;