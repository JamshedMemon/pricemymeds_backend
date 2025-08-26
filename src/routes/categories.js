const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

// GET all categories with subcategories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ active: true })
      .sort('order name')
      .select('-__v');
    
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories' });
  }
});

// GET single category with subcategories
router.get('/:categoryId', async (req, res) => {
  try {
    const category = await Category.findOne({ 
      id: req.params.categoryId,
      active: true 
    }).select('-__v');
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Error fetching category' });
  }
});

// GET subcategory details
router.get('/:categoryId/:subcategoryId', async (req, res) => {
  try {
    const category = await Category.findOne({ 
      id: req.params.categoryId,
      'subcategories.id': req.params.subcategoryId,
      active: true 
    });
    
    if (!category) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }
    
    const subcategory = category.subcategories.find(
      sub => sub.id === req.params.subcategoryId
    );
    
    res.json({
      category: {
        id: category.id,
        name: category.name
      },
      subcategory
    });
  } catch (error) {
    console.error('Error fetching subcategory:', error);
    res.status(500).json({ message: 'Error fetching subcategory' });
  }
});

module.exports = router;