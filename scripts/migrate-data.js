#!/usr/bin/env node

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Category = require('../src/models/Category');
const Medication = require('../src/models/Medication');
const Pharmacy = require('../src/models/Pharmacy');
const Price = require('../src/models/Price');
const User = require('../src/models/User');

// Load and parse the medications.json file
const loadMedicationsData = () => {
  const filePath = path.join(__dirname, '../../frontend-only/public/data/medications.json');
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ medications.json not found at:', filePath);
    process.exit(1);
  }
  
  const rawData = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(rawData);
};

// Condition to category mappings (same as in frontend parser)
const CONDITION_MAPPINGS = {
  'WEIGHT LOSS': { 
    categoryId: 'weight-loss', 
    categoryName: 'Weight Loss', 
    subcategoryId: 'weight-loss-medications', 
    subcategoryName: 'Weight Loss Medications' 
  },
  'HAIR LOSS': { 
    categoryId: 'mens-health', 
    categoryName: "Men's Health", 
    subcategoryId: 'hair-loss', 
    subcategoryName: 'Hair Loss' 
  },
  'Hair Loss': { 
    categoryId: 'mens-health', 
    categoryName: "Men's Health", 
    subcategoryId: 'hair-loss', 
    subcategoryName: 'Hair Loss' 
  },
  'Erectyle Dysfunction': { 
    categoryId: 'mens-health', 
    categoryName: "Men's Health", 
    subcategoryId: 'ed', 
    subcategoryName: 'Erectile Dysfunction' 
  },
  'Erectile Dysfunction': { 
    categoryId: 'mens-health', 
    categoryName: "Men's Health", 
    subcategoryId: 'ed', 
    subcategoryName: 'Erectile Dysfunction' 
  },
  'Premature Ejaculation': { 
    categoryId: 'mens-health', 
    categoryName: "Men's Health", 
    subcategoryId: 'premature-ejaculation', 
    subcategoryName: 'Premature Ejaculation' 
  },
  'Oral Contraceptives': { 
    categoryId: 'womens-health', 
    categoryName: "Women's Health", 
    subcategoryId: 'oral-contraceptives', 
    subcategoryName: 'Oral Contraceptives' 
  },
  'Contraceptives': { 
    categoryId: 'womens-health', 
    categoryName: "Women's Health", 
    subcategoryId: 'other-contraceptives', 
    subcategoryName: 'Other Contraceptives' 
  },
  'Contraceptive Patches': { 
    categoryId: 'womens-health', 
    categoryName: "Women's Health", 
    subcategoryId: 'other-contraceptives', 
    subcategoryName: 'Other Contraceptives' 
  },
  'Morning After Pill': { 
    categoryId: 'womens-health', 
    categoryName: "Women's Health", 
    subcategoryId: 'morning-after-pill', 
    subcategoryName: 'Morning After Pill' 
  },
  'Period Delay': { 
    categoryId: 'womens-health', 
    categoryName: "Women's Health", 
    subcategoryId: 'period-delay', 
    subcategoryName: 'Period Delay' 
  },
  'Cystitis': { 
    categoryId: 'womens-health', 
    categoryName: "Women's Health", 
    subcategoryId: 'cystitis', 
    subcategoryName: 'Cystitis Treatment' 
  },
  'Acne': { 
    categoryId: 'skin-treatment', 
    categoryName: 'Acne & Skin Treatment', 
    subcategoryId: 'acne', 
    subcategoryName: 'Acne Treatment' 
  },
  'Eczema & Dermatitis': { 
    categoryId: 'skin-treatment', 
    categoryName: 'Acne & Skin Treatment', 
    subcategoryId: 'eczema-dermatitis', 
    subcategoryName: 'Eczema & Dermatitis' 
  },
  'Psoriasis': { 
    categoryId: 'skin-treatment', 
    categoryName: 'Acne & Skin Treatment', 
    subcategoryId: 'psoriasis', 
    subcategoryName: 'Psoriasis' 
  },
  'Rosacea': { 
    categoryId: 'skin-treatment', 
    categoryName: 'Acne & Skin Treatment', 
    subcategoryId: 'rosacea', 
    subcategoryName: 'Rosacea' 
  },
  'Impetigo': { 
    categoryId: 'skin-treatment', 
    categoryName: 'Acne & Skin Treatment', 
    subcategoryId: 'impetigo', 
    subcategoryName: 'Impetigo' 
  },
  'Migraine': {
    categoryId: 'general-health',
    categoryName: 'General Health',
    subcategoryId: 'migraine',
    subcategoryName: 'Migraine Treatment'
  }
};

async function migrateData() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Clear existing data (optional - comment out if you want to append)
    console.log('🗑️  Clearing existing data...');
    await Promise.all([
      Category.deleteMany({}),
      Medication.deleteMany({}),
      Pharmacy.deleteMany({}),
      Price.deleteMany({})
    ]);
    
    // Load medications data
    console.log('📂 Loading medications.json...');
    const rawData = loadMedicationsData();
    console.log(`✅ Loaded ${Object.keys(rawData).length} medication sheets`);
    
    // Parse data
    const medications = [];
    const pharmaciesMap = new Map();
    const pricesArray = [];
    const categoriesMap = new Map();
    const subcategoriesAdded = new Set();
    
    console.log('🔄 Processing medication data...');
    
    Object.entries(rawData).forEach(([sheetName, sheetData]) => {
      if (!Array.isArray(sheetData) || sheetData.length < 6) return;
      
      // Extract medication info
      let row3 = sheetData[3];
      let condition = row3?.[1]?.toString().trim();
      let medicationName = row3?.[2]?.toString().trim() || sheetName;
      let form = row3?.[3]?.toString().trim() || '';
      
      // Check if data is in row 4 instead
      if (!condition && sheetData[4]) {
        const row4 = sheetData[4];
        condition = row4[1]?.toString().trim();
        medicationName = row4[2]?.toString().trim() || sheetName;
        form = row4[3]?.toString().trim() || '';
      }
      
      if (!condition) return;
      
      const mapping = CONDITION_MAPPINGS[condition];
      if (!mapping) {
        console.warn(`⚠️  No mapping for condition: ${condition}`);
        return;
      }
      
      // Create unique medication ID - make it URL-safe by replacing % with 'pct'
      let medicationId = medicationName.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/%/g, 'pct')
        .replace(/\//g, '-');
      
      // Check if this medication ID already exists
      const existingMed = medications.find(m => m.id === medicationId);
      if (existingMed) {
        // If duplicate, append form or subcategory to make it unique
        if (form) {
          medicationId = `${medicationId}-${form.toLowerCase().replace(/\s+/g, '-')}`;
        } else {
          medicationId = `${medicationId}-${mapping.subcategoryId}`;
        }
        console.warn(`⚠️  Duplicate medication found: ${medicationName}, using ID: ${medicationId}`);
      }
      
      // Extract dosages
      const headerRow = sheetData[4];
      const dosages = [];
      const dosageIndices = {};
      
      if (Array.isArray(headerRow)) {
        for (let i = 2; i < headerRow.length; i++) {
          const header = headerRow[i]?.toString().trim();
          if (header && header !== '' && header.toLowerCase() !== 'link') {
            dosages.push(header);
            dosageIndices[i] = header;
          } else if (header?.toLowerCase() === 'link') {
            break;
          }
        }
      }
      
      // Add medication
      medications.push({
        id: medicationId,
        name: medicationName,
        category: mapping.categoryId,
        subcategory: mapping.subcategoryId,
        description: `${medicationName}${form ? ` - ${form}` : ''}`,
        dosage: dosages,
        form: form,
        active: true
      });
      
      // Add category if not already added
      if (!categoriesMap.has(mapping.categoryId)) {
        categoriesMap.set(mapping.categoryId, {
          id: mapping.categoryId,
          name: mapping.categoryName,
          subcategories: [],
          active: true
        });
      }
      
      // Add subcategory if not already added
      const subcategoryKey = `${mapping.categoryId}-${mapping.subcategoryId}`;
      if (!subcategoriesAdded.has(subcategoryKey)) {
        const category = categoriesMap.get(mapping.categoryId);
        if (category) {
          category.subcategories.push({
            id: mapping.subcategoryId,
            name: mapping.subcategoryName,
            categoryId: mapping.categoryId,
            active: true
          });
          subcategoriesAdded.add(subcategoryKey);
        }
      }
      
      // Process pharmacy rows
      for (let rowIndex = 5; rowIndex < sheetData.length; rowIndex++) {
        const row = sheetData[rowIndex];
        if (!Array.isArray(row) || row.length < 3) continue;
        
        const rating = parseFloat(row[0]) || 0;
        const pharmacyName = row[1]?.toString().trim();
        
        // Find the link
        let link = '';
        for (let i = row.length - 1; i >= 0; i--) {
          const cellValue = row[i]?.toString().trim();
          if (cellValue && cellValue.startsWith('http')) {
            link = cellValue;
            break;
          }
        }
        
        if (!pharmacyName || pharmacyName === '') continue;
        
        const pharmacyId = pharmacyName.toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        
        // Add pharmacy
        if (!pharmaciesMap.has(pharmacyId)) {
          pharmaciesMap.set(pharmacyId, {
            id: pharmacyId,
            name: pharmacyName,
            website: link || '#',
            rating: rating,
            deliveryTime: '1-3 days',
            prescriptionRequired: true,
            active: true
          });
        }
        
        // Add price data for each dosage
        Object.entries(dosageIndices).forEach(([index, dosage]) => {
          const price = row[parseInt(index)];
          if (price && (typeof price === 'number' || !isNaN(parseFloat(price)))) {
            const priceValue = typeof price === 'number' ? price : parseFloat(price);
            if (priceValue > 0) {
              pricesArray.push({
                medicationId: medicationId,
                pharmacyId: pharmacyId,
                price: priceValue,
                dosage: dosage,
                quantity: 1,
                inStock: true,
                link: link || undefined,
                source: 'migration'
              });
            }
          }
        });
      }
    });
    
    console.log(`✅ Parsed ${medications.length} medications`);
    console.log(`✅ Parsed ${pharmaciesMap.size} pharmacies`);
    console.log(`✅ Parsed ${pricesArray.length} prices`);
    console.log(`✅ Parsed ${categoriesMap.size} categories`);
    
    // Insert data into MongoDB
    console.log('💾 Inserting data into MongoDB...');
    
    // Insert categories
    if (categoriesMap.size > 0) {
      await Category.insertMany(Array.from(categoriesMap.values()));
      console.log(`✅ Inserted ${categoriesMap.size} categories`);
    }
    
    // Insert medications
    if (medications.length > 0) {
      await Medication.insertMany(medications);
      console.log(`✅ Inserted ${medications.length} medications`);
    }
    
    // Insert pharmacies
    if (pharmaciesMap.size > 0) {
      await Pharmacy.insertMany(Array.from(pharmaciesMap.values()));
      console.log(`✅ Inserted ${pharmaciesMap.size} pharmacies`);
    }
    
    // Insert prices in batches
    if (pricesArray.length > 0) {
      const batchSize = 1000;
      for (let i = 0; i < pricesArray.length; i += batchSize) {
        const batch = pricesArray.slice(i, i + batchSize);
        await Price.insertMany(batch, { ordered: false }).catch(err => {
          // Ignore duplicate key errors
          if (err.code !== 11000) throw err;
        });
        console.log(`  Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(pricesArray.length/batchSize)}`);
      }
      console.log(`✅ Inserted ${pricesArray.length} prices`);
    }
    
    // Create default admin user
    console.log('👤 Creating default admin user...');
    const existingAdmin = await User.findOne({ email: 'admin@pricemymeds.co.uk' });
    
    if (!existingAdmin) {
      const adminUser = new User({
        email: 'admin@pricemymeds.co.uk',
        password: 'ChangeMeNow123!', // You should change this immediately
        name: 'Admin User',
        role: 'admin',
        active: true
      });
      
      await adminUser.save();
      console.log('✅ Created default admin user:');
      console.log('   Email: admin@pricemymeds.co.uk');
      console.log('   Password: ChangeMeNow123!');
      console.log('   ⚠️  IMPORTANT: Change this password immediately!');
    } else {
      console.log('ℹ️  Admin user already exists');
    }
    
    // Show summary
    console.log('\n📊 Migration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const [catCount, medCount, pharmCount, priceCount] = await Promise.all([
      Category.countDocuments(),
      Medication.countDocuments(),
      Pharmacy.countDocuments(),
      Price.countDocuments()
    ]);
    
    console.log(`Categories:   ${catCount}`);
    console.log(`Medications:  ${medCount}`);
    console.log(`Pharmacies:   ${pharmCount}`);
    console.log(`Prices:       ${priceCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration
if (require.main === module) {
  migrateData();
}

module.exports = migrateData;