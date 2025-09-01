const express = require('express');
const router = express.Router();
const AdminMessage = require('../models/AdminMessage');
const { verifyToken, requireRole } = require('../middleware/auth');

// Get active messages for a medication (public endpoint)
router.get('/medication/:medicationId', async (req, res) => {
  try {
    const { medicationId } = req.params;
    const now = new Date();
    
    const messages = await AdminMessage.find({
      medicationId,
      active: true,
      startDate: { $lte: now },
      $or: [
        { endDate: null },
        { endDate: { $gt: now } }
      ]
    })
    .sort({ priority: -1, createdAt: -1 })
    .select('medicationId medicationName pharmacyId pharmacyName category title message active startDate endDate priority createdAt updatedAt');
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching admin messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Get all messages (admin only)
router.get('/', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { active, category, medicationId } = req.query;
    const filter = {};
    
    if (active !== undefined) filter.active = active === 'true';
    if (category) filter.category = category;
    if (medicationId) filter.medicationId = medicationId;
    
    const messages = await AdminMessage.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching all messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Create a new message (admin only)
router.post('/', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const {
      medicationId,
      medicationName,
      category,
      title,
      message,
      startDate,
      endDate,
      priority
    } = req.body;
    
    // Validate required fields
    if (!medicationId || !medicationName || !category || !title || !message) {
      return res.status(400).json({ 
        message: 'Missing required fields: medicationId, medicationName, category, title, and message are required' 
      });
    }
    
    const adminMessage = new AdminMessage({
      medicationId,
      medicationName,
      category,
      title,
      message,
      startDate: startDate || Date.now(),
      endDate: endDate || null,
      priority: priority || 0,
      createdBy: req.user._id
    });
    
    await adminMessage.save();
    
    res.status(201).json({
      message: 'Admin message created successfully',
      data: adminMessage
    });
  } catch (error) {
    console.error('Error creating admin message:', error);
    res.status(500).json({ message: 'Error creating message' });
  }
});

// Update a message (admin only)
router.put('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Don't allow updating createdBy
    delete updates.createdBy;
    
    updates.updatedAt = Date.now();
    
    const message = await AdminMessage.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    res.json({
      message: 'Admin message updated successfully',
      data: message
    });
  } catch (error) {
    console.error('Error updating admin message:', error);
    res.status(500).json({ message: 'Error updating message' });
  }
});

// Delete a message (admin only)
router.delete('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const message = await AdminMessage.findByIdAndDelete(id);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    res.json({ message: 'Admin message deleted successfully' });
  } catch (error) {
    console.error('Error deleting admin message:', error);
    res.status(500).json({ message: 'Error deleting message' });
  }
});

// Toggle message active status (admin only)
router.patch('/:id/toggle', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const message = await AdminMessage.findById(id);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    message.active = !message.active;
    message.updatedAt = Date.now();
    await message.save();
    
    res.json({
      message: `Message ${message.active ? 'activated' : 'deactivated'} successfully`,
      data: message
    });
  } catch (error) {
    console.error('Error toggling message status:', error);
    res.status(500).json({ message: 'Error toggling message status' });
  }
});

module.exports = router;