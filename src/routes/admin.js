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
const Contact = require('../models/Contact');
const PriceAlert = require('../models/PriceAlert');

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
    
    res.status(201).json({ id: medication.id, ...medication.toObject() });
  } catch (error) {
    console.error('Error creating medication:', error);
    res.status(500).json({ 
      message: 'Error creating medication',
      error: error.message || 'Unknown error occurred',
      ...(process.env.NODE_ENV === 'development' && { details: error })
    });
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

// POST add subcategory to a category
router.post('/categories/:categoryId/subcategories', [
  body('name').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { categoryId } = req.params;
    const { name } = req.body;
    
    // Generate subcategory ID from name
    const subcategoryId = name.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    // Find the category
    const category = await Category.findOne({ id: categoryId });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Check if subcategory already exists
    const existingSubcat = category.subcategories.find(sub => sub.id === subcategoryId);
    if (existingSubcat) {
      return res.status(400).json({ message: 'Subcategory already exists' });
    }
    
    // Add new subcategory
    const newSubcategory = {
      id: subcategoryId,
      name: name,
      categoryId: categoryId,
      order: category.subcategories.length,
      active: true
    };
    
    category.subcategories.push(newSubcategory);
    category.updatedAt = new Date();
    
    await category.save();
    
    await logAction(req, 'subcategory_create', 'category', category.id, newSubcategory);
    
    res.json({ 
      subcategory: newSubcategory,
      category: category 
    });
  } catch (error) {
    console.error('Error adding subcategory:', error);
    res.status(500).json({ message: 'Error adding subcategory' });
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

// ===== CONTACT MESSAGES MANAGEMENT =====

// GET all contacts (with pagination)
router.get('/contacts', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { subject: new RegExp(search, 'i') }
      ];
    }
    
    const [contacts, total] = await Promise.all([
      Contact.find(filter)
        .skip(skip)
        .limit(parseInt(limit))
        .sort('-createdAt'),
      Contact.countDocuments(filter)
    ]);
    
    res.json({
      contacts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Error fetching contacts' });
  }
});

// GET single contact
router.get('/contacts/:id', async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }
    
    // Mark as read if it was new
    if (contact.status === 'new') {
      contact.status = 'read';
      await contact.save();
    }
    
    res.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ message: 'Error fetching contact' });
  }
});

// PUT update contact status
router.put('/contacts/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        notes,
        ...(status === 'replied' && { repliedAt: new Date() })
      },
      { new: true }
    );
    
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }
    
    await logAction(req, 'contact_update', 'contact', contact._id, { status, notes });
    
    res.json(contact);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ message: 'Error updating contact' });
  }
});

// DELETE contact
router.delete('/contacts/:id', requireRole('admin'), async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }
    
    await logAction(req, 'contact_delete', 'contact', contact._id);
    
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ message: 'Error deleting contact' });
  }
});

// ===== PRICE ALERTS MANAGEMENT =====

// GET all price alerts (with pagination)
router.get('/price-alerts', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, medicationId, search } = req.query;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (status) filter.status = status;
    if (medicationId) filter.medicationId = medicationId;
    if (search) {
      filter.$or = [
        { email: new RegExp(search, 'i') },
        { medicationName: new RegExp(search, 'i') }
      ];
    }
    
    const [alerts, total] = await Promise.all([
      PriceAlert.find(filter)
        .skip(skip)
        .limit(parseInt(limit))
        .sort('-createdAt'),
      PriceAlert.countDocuments(filter)
    ]);
    
    res.json({
      alerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching price alerts:', error);
    res.status(500).json({ message: 'Error fetching price alerts' });
  }
});

// GET price alerts statistics
router.get('/price-alerts/stats', async (req, res) => {
  try {
    const [total, active, triggered, expired] = await Promise.all([
      PriceAlert.countDocuments(),
      PriceAlert.countDocuments({ status: 'active' }),
      PriceAlert.countDocuments({ status: 'triggered' }),
      PriceAlert.countDocuments({ status: 'expired' })
    ]);
    
    res.json({
      total,
      active,
      triggered,
      expired
    });
  } catch (error) {
    console.error('Error fetching alert stats:', error);
    res.status(500).json({ message: 'Error fetching statistics' });
  }
});

// PUT update price alert status
router.put('/price-alerts/:id', async (req, res) => {
  try {
    const { status } = req.body;
    
    const alert = await PriceAlert.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        ...(status === 'triggered' && { triggeredAt: new Date() })
      },
      { new: true }
    );
    
    if (!alert) {
      return res.status(404).json({ message: 'Price alert not found' });
    }
    
    await logAction(req, 'alert_update', 'pricealert', alert._id, { status });
    
    res.json(alert);
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({ message: 'Error updating alert' });
  }
});

// DELETE price alert
router.delete('/price-alerts/:id', requireRole('admin'), async (req, res) => {
  try {
    const alert = await PriceAlert.findByIdAndDelete(req.params.id);
    
    if (!alert) {
      return res.status(404).json({ message: 'Price alert not found' });
    }
    
    await logAction(req, 'alert_delete', 'pricealert', alert._id);
    
    res.json({ message: 'Price alert deleted successfully' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ message: 'Error deleting alert' });
  }
});

// ===== ADMIN MESSAGES MANAGEMENT =====
const AdminMessage = require('../models/AdminMessage');

// GET all admin messages
router.get('/admin-messages', async (req, res) => {
  try {
    const { active, category, medicationId } = req.query;
    const filter = {};
    
    if (active !== undefined) filter.active = active === 'true';
    if (category) filter.category = category;
    if (medicationId) filter.medicationId = medicationId;
    
    const messages = await AdminMessage.find(filter)
      .sort({ priority: -1, createdAt: -1 });
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching admin messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// POST create admin message
router.post('/admin-messages', async (req, res) => {
  try {
    const {
      medicationId,
      medicationName,
      pharmacyId,
      pharmacyName,
      category,
      title,
      message,
      startDate,
      endDate,
      priority
    } = req.body;
    
    const adminMessage = new AdminMessage({
      medicationId,
      medicationName,
      pharmacyId: pharmacyId || null,
      pharmacyName: pharmacyName || null,
      category,
      title,
      message,
      startDate: startDate || Date.now(),
      endDate: endDate || null,
      priority: priority || 0,
      active: true,
      createdBy: req.user?._id
    });
    
    await adminMessage.save();
    await logAction(req, 'message_create', 'adminmessage', adminMessage._id);
    
    res.status(201).json(adminMessage);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ message: 'Error creating message' });
  }
});

// PUT update admin message
router.put('/admin-messages/:id', async (req, res) => {
  try {
    const message = await AdminMessage.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    await logAction(req, 'message_update', 'adminmessage', message._id);
    res.json(message);
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ message: 'Error updating message' });
  }
});

// PATCH toggle admin message active status
router.patch('/admin-messages/:id/toggle', async (req, res) => {
  try {
    const message = await AdminMessage.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    message.active = !message.active;
    await message.save();
    
    await logAction(req, 'message_toggle', 'adminmessage', message._id);
    res.json(message);
  } catch (error) {
    console.error('Error toggling message:', error);
    res.status(500).json({ message: 'Error toggling message status' });
  }
});

// DELETE admin message
router.delete('/admin-messages/:id', async (req, res) => {
  try {
    const message = await AdminMessage.findByIdAndDelete(req.params.id);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    await logAction(req, 'message_delete', 'adminmessage', message._id);
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ message: 'Error deleting message' });
  }
});

// ===== EMAIL SUBSCRIPTIONS MANAGEMENT =====
const EmailSubscription = require('../models/EmailSubscription');

// GET all subscriptions
router.get('/subscriptions', async (req, res) => {
  try {
    const { status, source } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (source) filter.source = source;
    
    const subscriptions = await EmailSubscription.find(filter)
      .sort({ subscribedAt: -1 });
    
    // Calculate stats
    const stats = {
      total: await EmailSubscription.countDocuments(),
      active: await EmailSubscription.countDocuments({ status: 'active' }),
      unsubscribed: await EmailSubscription.countDocuments({ status: 'unsubscribed' }),
      bounced: await EmailSubscription.countDocuments({ status: 'bounced' })
    };
    
    res.json({ subscriptions, stats });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ message: 'Error fetching subscriptions' });
  }
});

// GET subscription stats
router.get('/subscriptions/stats', async (req, res) => {
  try {
    const [total, active, unsubscribed, bounced, bySource, recentSubscriptions] = await Promise.all([
      EmailSubscription.countDocuments(),
      EmailSubscription.countDocuments({ status: 'active' }),
      EmailSubscription.countDocuments({ status: 'unsubscribed' }),
      EmailSubscription.countDocuments({ status: 'bounced' }),
      EmailSubscription.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ]),
      EmailSubscription.find({ status: 'active' })
        .sort({ subscribedAt: -1 })
        .limit(5)
        .select('email subscribedAt source')
    ]);
    
    res.json({
      total,
      active,
      unsubscribed,
      bounced,
      bySource,
      recentSubscriptions
    });
  } catch (error) {
    console.error('Error fetching subscription stats:', error);
    res.status(500).json({ message: 'Error fetching statistics' });
  }
});

// DELETE subscription
router.delete('/subscriptions/:id', async (req, res) => {
  try {
    const subscription = await EmailSubscription.findByIdAndDelete(req.params.id);
    
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    
    await logAction(req, 'subscription_delete', 'subscription', subscription._id);
    res.json({ message: 'Subscription deleted successfully' });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({ message: 'Error deleting subscription' });
  }
});

module.exports = router;