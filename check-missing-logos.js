const pharmacies = [
  'Asda Online Dr',
  'Ashcroft Pharmacy',
  'Boots online Dr',
  'Boots online Dr - One Off Treatment',
  'Boots online Dr - Subscription',
  'Chemist Click',
  'Chemist4U',
  'Cheq up',
  'CheqUp',
  'Click Pharmacy',
  'Click2Pharmacy',
  'Cloud Pharmacy',
  'Dr Fox',
  'e-surgery',
  'e-surgery Monthly subscription',
  'e-surgery one off',
  'Farmeci',
  'Get a Drip',
  'Health Express',
  'IQ Doctor',
  'Juniper',
  'Live Well Weight Loss',
  'Lloyds Pharmacy Online Dr',
  'Med Express',
  'Menschem',
  'MyBMI',
  'Numan',
  'Online Clinic',
  'Oushk Pharmacy',
  'Oxford Online Pharmacy',
  'Pharmacy Express',
  'Pharmacy2u',
  'Pharmica',
  'Pharmulous',
  'Phlo Clinic',
  'Pill time',
  'Post my Meds',
  'Rightangled',
  'Rightangled Subscription',
  'She med',
  'Simple Online Pharmacy',
  'Simply Meds',
  'Superdrug Online Dr',
  'The independent Pharmacy',
  'UK Meds',
  'UK Meds - Subscription',
  'UsMen',
  'Voy',
  'Weprescribe',
  'Zava'
];

// Pharmacy logo mappings from frontend
const PHARMACY_LOGO_MAPPINGS = {
  'asda online dr': 'asda-pharmacy.png',
  'asda': 'asda-pharmacy.png',
  'boots online dr': 'boots-pharmacy.png',
  'boots': 'boots-pharmacy.png',
  'chemist4u': 'chemist4u.png',
  'chemist 4 u': 'chemist4u.png',
  'chemistclick': 'chemistclick.jpeg',
  'chemist click': 'chemistclick.jpeg',
  'chemist-click': 'chemistclick.jpeg',
  'chemistdirect': 'chemistdirect.png',
  'chemist direct': 'chemistdirect.png',
  'chequp': 'chequp.png',
  'cheq up': 'chequp.png',
  'dr fox': 'drfox.png',
  'drfox': 'drfox.png',
  'e-surgery': 'e-surgery.png',
  'e-surgery one off': 'e-surgery.png',
  'esurgery': 'e-surgery.png',
  'health express': 'health-express.png',
  'healthexpress': 'health-express.png',
  'independent pharmacy': 'independent-pharmacy.jpeg',
  'the independent pharmacy': 'independent-pharmacy.jpeg',
  'juniper': 'juniper.png',
  'lloyds pharmacy': 'lloydspharmacy.png',
  'lloydspharmacy': 'lloydspharmacy.png',
  'lloyds': 'lloydspharmacy.png',
  'lloyds pharmacy online dr': 'lloydspharmacy.png',
  'manual': 'manual.jpeg',
  'med express': 'medexpress.png',
  'medexpress': 'medexpress.png',
  'numan': 'numan.png',
  'online clinic': 'online-clinic.webp',
  'oxford online': 'oxfordonline.jpeg',
  'oxford online pharmacy': 'oxfordonline.jpeg',
  'pharmacy2u': 'pharmacy2u.jpeg',
  'pharmacy 2 u': 'pharmacy2u.jpeg',
  'phlo clinic': 'phlo-clinic.png',
  'phlo': 'phlo-clinic.png',
  'pilltime': 'pilltime.png',
  'pill time': 'pilltime.png',
  'postmymeds': 'postmymeds.png',
  'post my meds': 'postmymeds.png',
  'shemed': 'shemed.png',
  'she med': 'shemed.png',
  'simple online pharmacy': 'simple.png',
  'simple': 'simple.png',
  'simplymeds online': 'simplymeds.png',
  'simplymeds': 'simplymeds.png',
  'simply meds': 'simplymeds.png',
  'sons': 'sons.jpeg',
  'superdrug': 'superdrug.png',
  'superdrug online dr': 'superdrug.png',
  'uk meds': 'ukmeds.png',
  'ukmeds': 'ukmeds.png',
  'voy': 'voy.jpeg',
  'well pharmacy': 'well-pharmacy.jpeg',
  'weprescribe': 'weprescribe.png',
  'we prescribe': 'weprescribe.png',
  'zava': 'zava.png',
  'pharmica': 'pharmica.png',
  'cloudpharmacy': 'cloudpharmacy.jpg',
  'cloud pharmacy': 'cloudpharmacy.jpg',
  'menschem': 'Menschem.png',
  'mens chem': 'Menschem.png',
  'ashcroft pharmacy': 'ashcroft-pharmacy.png',
  'click pharmacy': 'click-pharmacy.svg',
  'click2pharmacy': 'Click2-Pharmacy.png',
  'farmeci': 'farmeci.png',
  'get a drip': 'getadrip.png',
  'iq doctor': 'iq-doctor.png',
  'live well weight loss': 'livewell-weightloss.png',
  'mybmi': 'mybmi.png',
  'my bmi': 'mybmi.png',
  'oushk pharmacy': 'oushk-pharmacy.png',
  'oushk': 'oushk-pharmacy.png',
  'pharmacy express': 'pharmacy-express.png',
  'pharmulous': 'harmulous.png',
  'rightangled': 'Rightangled.jpeg',
  'rightangled subscription': 'Rightangled.jpeg',
  'usmen': 'usmen.jpeg',
  'us men': 'usmen.jpeg',
};

const existingLogos = [
  'asda-pharmacy.png',
  'ashcroft-pharmacy.png',
  'boots-pharmacy.png',
  'chemist4u.png',
  'chemistclick.jpeg',
  'chemistdirect.png',
  'chequp.png',
  'click-pharmacy.svg',
  'Click2-Pharmacy.png',
  'cloudpharmacy.jpg',
  'drfox.png',
  'e-surgery.png',
  'farmeci.png',
  'getadrip.png',
  'harmulous.png',
  'health-express.png',
  'independent-pharmacy.jpeg',
  'iq-doctor.png',
  'juniper.png',
  'livewell-weightloss.png',
  'lloydspharmacy.png',
  'manual.jpeg',
  'medexpress.png',
  'Menschem.png',
  'mybmi.png',
  'numan.png',
  'online-clinic.webp',
  'oushk-pharmacy.png',
  'oxfordonline.jpeg',
  'pharmacy-express.png',
  'pharmacy2u.jpeg',
  'pharmica.png',
  'phlo-clinic.png',
  'pilltime.png',
  'postmymeds.png',
  'Rightangled.jpeg',
  'shemed.png',
  'simple.png',
  'simplymeds.png',
  'sons.jpeg',
  'superdrug.png',
  'ukmeds.png',
  'usmen.jpeg',
  'voy.jpeg',
  'well-pharmacy.jpeg',
  'weprescribe.png',
  'zava.png'
];

console.log('=== PHARMACY LOGO ANALYSIS ===\n');

const hasLogo = [];
const missingLogo = [];

pharmacies.forEach(pharmacy => {
  const normalizedName = pharmacy.toLowerCase().trim();
  let logoFile = null;
  
  // Check if pharmacy has a mapping
  if (PHARMACY_LOGO_MAPPINGS[normalizedName]) {
    logoFile = PHARMACY_LOGO_MAPPINGS[normalizedName];
  } else {
    // Try partial matches
    for (const [key, value] of Object.entries(PHARMACY_LOGO_MAPPINGS)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        logoFile = value;
        break;
      }
    }
  }
  
  if (logoFile && existingLogos.includes(logoFile)) {
    hasLogo.push({ pharmacy, logoFile });
  } else {
    missingLogo.push({ pharmacy, expectedFile: logoFile });
  }
});

console.log(`✅ Pharmacies WITH logos (${hasLogo.length}):`);
hasLogo.forEach(({ pharmacy, logoFile }) => {
  console.log(`   ${pharmacy} → ${logoFile}`);
});

console.log(`\n❌ Pharmacies WITHOUT logos (${missingLogo.length}):`);
missingLogo.forEach(({ pharmacy, expectedFile }) => {
  console.log(`   ${pharmacy} → ${expectedFile || 'No mapping defined'}`);
});

console.log('\n=== SUMMARY ===');
console.log(`Total pharmacies: ${pharmacies.length}`);
console.log(`With logos: ${hasLogo.length}`);
console.log(`Missing logos: ${missingLogo.length}`);
console.log(`Coverage: ${((hasLogo.length / pharmacies.length) * 100).toFixed(1)}%`);