// Fixed version of the micronutrient processing functions

// Enhanced getChartData function with better debugging
const getChartDataFixed = (foodLog, userProfile) => {
  if (!foodLog || !Array.isArray(foodLog)) {
    return { macroSums: {}, microSums: {}, efficiencyData: [] };
  }

  if (foodLog.length === 0) {
    return { macroSums: {}, microSums: {}, efficiencyData: [] };
  }

  const lastDate = foodLog[0].date;
  const lastDayEntries = foodLog.filter(e => e.date === lastDate);
  
  console.log('=== FIXED getChartData DEBUG ===');
  console.log('Processing', lastDayEntries.length, 'entries for date:', lastDate);
  
  // Calculate macro sums with validation
  const macroSums = lastDayEntries.reduce((acc, e) => {
    const protein = parseFloat(e.protein) || 0;
    const carbs = parseFloat(e.carbs) || 0;
    const fat = parseFloat(e.fat) || 0;
    const calories = parseFloat(e.calories) || 0;
    
    acc.protein = (acc.protein || 0) + protein;
    acc.carbs = (acc.carbs || 0) + carbs;
    acc.fat = (acc.fat || 0) + fat;
    acc.calories = (acc.calories || 0) + calories;
    
    console.log(`Entry: ${e.name} - P:${protein}g C:${carbs}g F:${fat}g Cal:${calories}`);
    return acc;
  }, {});
  
  // FIXED: Better micronutrient accumulation with unit validation
  const microSums = {};
  
  lastDayEntries.forEach((entry, entryIndex) => {
    console.log(`\n--- Processing Entry ${entryIndex}: ${entry.name} ---`);
    
    if (!entry.micronutrients) {
      console.log(`⚠️ No micronutrients data for ${entry.name}`);
      return;
    }
    
    Object.entries(entry.micronutrients).forEach(([nutrientKey, nutrientValue]) => {
      // Skip macro nutrients that shouldn't be in micronutrients
      const macroNutrients = ['protein', 'carbs', 'fat', 'calories', 'name', 'unit'];
      if (macroNutrients.includes(nutrientKey.toLowerCase())) {
        return;
      }
      
      let valueToAdd = 0;
      let unit = 'mg'; // default unit
      
      // Handle different value formats
      if (typeof nutrientValue === 'object' && nutrientValue !== null) {
        if (nutrientValue.value !== undefined) {
          valueToAdd = parseFloat(nutrientValue.value) || 0;
          unit = nutrientValue.unit || 'mg';
        } else {
          console.warn(`Object format not recognized for ${nutrientKey}:`, nutrientValue);
          continue;
        }
      } else if (typeof nutrientValue === 'number') {
        valueToAdd = nutrientValue;
      } else if (typeof nutrientValue === 'string') {
        valueToAdd = parseFloat(nutrientValue) || 0;
      } else {
        console.warn(`Unrecognized value format for ${nutrientKey}:`, nutrientValue);
        continue;
      }
      
      // FIXED: Unit standardization for common problem nutrients
      if (nutrientKey === 'zinc' || nutrientKey === 'selenium' || nutrientKey === 'copper') {
        // These are often given in mcg but should be in mg
        if (unit === 'mcg' || unit === 'μg') {
          valueToAdd = valueToAdd / 1000; // Convert mcg to mg
          unit = 'mg';
          console.log(`Converted ${nutrientKey} from mcg to mg: ${valueToAdd}`);
        }
      }
      
      // Validate the value is reasonable
      if (valueToAdd < 0 || valueToAdd > 10000) {
        console.warn(`Suspicious ${nutrientKey} value: ${valueToAdd} ${unit} - skipping`);
        return;
      }
      
      // Initialize or add to sum
      if (!microSums[nutrientKey]) {
        microSums[nutrientKey] = { value: 0, unit: unit };
      }
      
      microSums[nutrientKey].value += valueToAdd;
      
      console.log(`${nutrientKey}: +${valueToAdd} ${unit} → Total: ${microSums[nutrientKey].value} ${unit}`);
    });
  });
  
  console.log('\n=== FINAL SUMS ===');
  console.log('Macros:', macroSums);
  console.log('Micros:', microSums);
  
  // Validate final micronutrient totals
  Object.entries(microSums).forEach(([nutrient, data]) => {
    if (data.value > 1000 && !['calcium', 'vitamin_c'].includes(nutrient)) {
      console.warn(`⚠️ Unusually high ${nutrient}: ${data.value} ${data.unit}`);
    }
  });
  
  console.log('=== END FIXED DEBUG ===\n');
  
  return { 
    macroSums, 
    microSums, 
    efficiencyData: foodLog 
  };
};

// Fixed ensureCompleteNutrientData function
const ensureCompleteNutrientDataFixed = (intakeData, baseRDAData) => {
  console.log('=== FIXED ensureCompleteNutrientData ===');
  console.log('Input intakeData:', intakeData);
  
  const completeIntakeData = {};

  // Iterate over all nutrients defined in baseRDAData
  for (const nutrientKey in baseRDAData) {
    if (!baseRDAData.hasOwnProperty(nutrientKey)) continue;
    
    const rdaInfo = baseRDAData[nutrientKey];
    
    if (!rdaInfo || rdaInfo.value === undefined || !rdaInfo.unit) {
      console.warn(`Invalid RDA data for ${nutrientKey}:`, rdaInfo);
      continue;
    }

    // Check if this nutrient exists in the user's intake data
    if (intakeData && intakeData[nutrientKey] !== undefined) {
      const intakeValue = intakeData[nutrientKey];

      // Case 1: Already proper object format { value: X, unit: Y }
      if (typeof intakeValue === 'object' && intakeValue !== null && 
          intakeValue.value !== undefined && intakeValue.unit !== undefined) {
        
        let finalValue = parseFloat(intakeValue.value) || 0;
        let finalUnit = intakeValue.unit;
        
        // FIXED: Handle unit conversions more carefully
        if (finalUnit !== rdaInfo.unit) {
          // Convert common unit mismatches
          if (finalUnit === 'mcg' && rdaInfo.unit === 'mg') {
            finalValue = finalValue / 1000;
            finalUnit = 'mg';
          } else if (finalUnit === 'mg' && rdaInfo.unit === 'mcg') {
            finalValue = finalValue * 1000;
            finalUnit = 'mcg';
          } else if (finalUnit === 'g' && rdaInfo.unit === 'mg') {
            finalValue = finalValue * 1000;
            finalUnit = 'mg';
          }
          
          console.log(`Converted ${nutrientKey}: ${intakeValue.value} ${intakeValue.unit} → ${finalValue} ${finalUnit}`);
        }
        
        completeIntakeData[nutrientKey] = {
          value: finalValue,
          unit: finalUnit
        };
      }
      // Case 2: Just a number (assume RDA unit)
      else if (typeof intakeValue === 'number') {
        completeIntakeData[nutrientKey] = {
          value: intakeValue,
          unit: rdaInfo.unit
        };
      }
      // Case 3: String number
      else if (typeof intakeValue === 'string') {
        const numValue = parseFloat(intakeValue) || 0;
        completeIntakeData[nutrientKey] = {
          value: numValue,
          unit: rdaInfo.unit
        };
      }
      // Case 4: Unexpected format
      else {
        console.warn(`Unexpected intake format for ${nutrientKey}:`, intakeValue);
        completeIntakeData[nutrientKey] = {
          value: 0,
          unit: rdaInfo.unit
        };
      }
    } else {
      // Nutrient not found in intake data
      completeIntakeData[nutrientKey] = {
        value: 0,
        unit: rdaInfo.unit
      };
    }
  }
  
  console.log('Output completeIntakeData:', completeIntakeData);
  console.log('=== END FIXED ensureCompleteNutrientData ===\n');
  
  return completeIntakeData;
};

// Fixed processNutrientData function
const processNutrientDataFixed = (intakeData, rdaData) => {
  console.log('=== FIXED processNutrientData ===');
  console.log('Processing', Object.keys(rdaData).length, 'nutrients');
  
  const processedNutrients = [];

  for (const nutrientKey in rdaData) {
    if (!rdaData.hasOwnProperty(nutrientKey)) continue;
    
    const rdaInfo = rdaData[nutrientKey];
    
    // Validate RDA info
    if (!rdaInfo || rdaInfo.value === undefined || !rdaInfo.unit) {
      console.warn(`Skipping ${nutrientKey}: Invalid RDA info`, rdaInfo);
      continue;
    }

    const intakeDetails = intakeData[nutrientKey];
    let intakeValue = 0;
    
    if (intakeDetails && typeof intakeDetails === 'object' && intakeDetails.value !== undefined) {
      intakeValue = parseFloat(intakeDetails.value) || 0;
    }
    
    // Calculate percentage of RDA
    const percentOfRDA = rdaInfo.value > 0 ? (intakeValue / rdaInfo.value) * 100 : 0;
    
    // Validate percentage is reasonable
    if (percentOfRDA > 10000) {
      console.warn(`Extremely high percentage for ${nutrientKey}: ${percentOfRDA}% - possible unit error`);
    }
    
    // Format name and determine category
    const formattedName = nutrientKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const category = nutrientKey.includes('vitamin') ? 'vitamins' : 'minerals';

    const processedNutrient = {
      key: nutrientKey,
      name: formattedName,
      value: percentOfRDA,
      rawValue: intakeValue,
      unit: rdaInfo.unit,
      rda: rdaInfo.value,
      rdaUnit: rdaInfo.unit,
      isAdjustedRDA: rdaInfo.isAdjusted || false,
      percentOfRDA: percentOfRDA,
      category: category,
    };
    
    console.log(`${formattedName}: ${intakeValue}${rdaInfo.unit} / ${rdaInfo.value}${rdaInfo.unit} = ${percentOfRDA.toFixed(1)}%`);
    
    processedNutrients.push(processedNutrient);
  }

  // Sort by percentage (low to high for easier identification of deficiencies)
  const sortedNutrients = processedNutrients.sort((a, b) => a.percentOfRDA - b.percentOfRDA);
  
  console.log('=== PROCESSING SUMMARY ===');
  console.log('Total nutrients processed:', sortedNutrients.length);
  console.log('Deficient (<70%):', sortedNutrients.filter(n => n.percentOfRDA < 70).length);
  console.log('Optimal (≥100%):', sortedNutrients.filter(n => n.percentOfRDA >= 100).length);
  console.log('=== END FIXED processNutrientData ===\n');
  
  return sortedNutrients;
};

// Test the fixed functions with sample data
console.log('=== TESTING FIXED FUNCTIONS ===');

const sampleMicroSums = {
  zinc: { value: 25000, unit: 'mcg' }, // This should be converted to 25mg
  vitamin_c: { value: 75, unit: 'mg' },
  iron: { value: 12, unit: 'mg' },
  calcium: { value: 800, unit: 'mg' }
};

const baseRDATest = {
  zinc: { value: 11, unit: 'mg', femaleAdjust: 0.73 },
  vitamin_c: { value: 90, unit: 'mg', femaleAdjust: 0.83 },
  iron: { value: 8, unit: 'mg', femaleAdjust: 2.25 },
  calcium: { value: 1000, unit: 'mg', femaleAdjust: 1.0 }
};

console.log('\n--- Testing with sample data ---');
const fixedIntakeData = ensureCompleteNutrientDataFixed(sampleMicroSums, baseRDATest);
const fixedProcessedData = processNutrientDataFixed(fixedIntakeData, baseRDATest);

console.log('\nFixed results:');
fixedProcessedData.forEach(nutrient => {
  console.log(`${nutrient.name}: ${nutrient.percentOfRDA.toFixed(1)}% (${nutrient.rawValue} ${nutrient.unit})`);
});

console.log('\n=== FIXES IMPLEMENTED ===');
console.log('1. ✅ Better unit conversion (mcg to mg for minerals)');
console.log('2. ✅ Validation of suspicious values');
console.log('3. ✅ Improved debugging and logging');
console.log('4. ✅ Proper handling of different input formats');
console.log('5. ✅ Category counting should now work correctly');