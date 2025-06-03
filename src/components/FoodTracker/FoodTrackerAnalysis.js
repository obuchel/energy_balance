import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import './MicronutrientChart.css'; // Import CSS file
import './FoodTrackerAnalysis.css';
 // Import the new component
 import { 
  estimateMicronutrientEnhancement, 
  estimateStandardMicronutrientEnhancement,
  calculateFoodEfficiency,
  getSeverityFactor
} from './enhanced-efficiency-functions';


 const debugMealData = (mealData) => {
  console.log("=== MEAL DATA DEBUGGER ===");
  
  // Sort by time for easier debugging
  const sortedData = [...mealData].sort((a, b) => {
    return a.time.localeCompare(b.time);
  });
  
  // Log each meal's data in sorted order
  sortedData.forEach(meal => {
    console.log(
      `Time: "${meal.time}" | ` +
      `MealType: "${meal.mealType}" | ` + 
      `Date: "${meal.date}"`
    );
  });
  
  console.log("=== END MEAL DATA ===");
  
  // Return the original data for chaining
  return mealData;
};
 const convertTo24Hour = (time12h) => {
  // Convert 12-hour time format to 24-hour format for input[type="time"]
  if (!time12h) return '';
  
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  
  if (hours === '12') {
    hours = '00';
  }
  
  if (modifier === 'PM') {
    hours = parseInt(hours, 10) + 12;
  }
  
  return `${hours}:${minutes}`;
};
 /*const prepareChartData = (rawMealData) => {
  // Convert all time values to proper 24-hour format
  const formattedData = rawMealData.map(meal => {
    return {
      ...meal,
      // Ensure time is in proper HH:MM:00 format
      time: convertTo24Hour(meal.time)
    };
  });
  
  // Optional: Debug the data
  debugMealData(formattedData);
  
  return formattedData;
};
*/



// Add this improved prepareChartData function to FoodTrackerAnalysis.js
// Replace the existing prepareChartData function with this safer version:

const prepareChartData = (rawMealData) => {
  console.log('prepareChartData called with:', rawMealData);
  
  if (!rawMealData || !Array.isArray(rawMealData)) {
    console.warn('prepareChartData: Invalid input data');
    return [];
  }

  try {
    // Convert all time values to proper 24-hour format
    const formattedData = rawMealData.map((meal, index) => {
      try {
        return {
          ...meal,
          // Ensure time is in proper HH:MM format
          time: convertTo24Hour(meal.time || '12:00 PM')
        };
      } catch (err) {
        console.warn(`Error processing meal ${index} in prepareChartData:`, err);
        return {
          ...meal,
          time: '12:00' // Default fallback time
        };
      }
    });
    
    // Optional: Debug the data
    debugMealData(formattedData);
    
    console.log('prepareChartData completed successfully:', formattedData.length, 'items');
    return formattedData;
  } catch (err) {
    console.error('Error in prepareChartData:', err);
    return rawMealData || []; // Return original data as fallback
  }
};

// Make sure convertTo24Hour function is safe:


// Make debugMealData function safe:



// Enhanced Analysis tab for the FoodTrackerPage component
const baseRDAData1 = {
  vitamin_a: {
    value: 0,
    unit: 'mcg',
    femaleAdjust: 0.78, // 700/900
    description: "Supports vision, immune function, and cell growth"
  },
  vitamin_c: {
    value: 0,
    unit: 'mg',
    femaleAdjust: 0.83, // 75/90
    description: "Antioxidant that supports immune function and collagen production"
  },
  vitamin_d: {
    value: 0,
    unit: 'mcg',
    femaleAdjust: 1.0,
    description: "Crucial for calcium absorption and bone health"
  },
  vitamin_e: {
    value: 0,
    unit: 'mg',
    femaleAdjust: 1.0,
    description: "Antioxidant that protects cells from damage"
  },
  vitamin_b6: {
    value: 0,
    unit: 'mg',
    femaleAdjust: 1.0,
    description: "Important for metabolism and brain development"
  },
  vitamin_b12: {
    value: 0,
    unit: 'mcg',
    femaleAdjust: 1.0,
    description: "Essential for nerve function and blood cell formation"
  },
  folate: {
    value: 0,
    unit: 'mcg',
    femaleAdjust: 1.0,
    description: "Critical for cell division and DNA synthesis"
  },
  iron: {
    value: 0,
    unit: 'mg',
    femaleAdjust: 2.25, // 18/8
    description: "Essential for oxygen transport in the blood"
  },
  calcium: {
    value: 0,
    unit: 'mg',
    femaleAdjust: 1.0,
    description: "Critical for bone health and muscle function"
  },
  magnesium: {
    value: 0,
    unit: 'mg',
    femaleAdjust: 0.76, // 320/420
    description: "Involved in over 300 biochemical reactions in the body"
  },
  zinc: {
    value: 0,
    unit: 'mg',
    femaleAdjust: 0.73, // 8/11
    description: "Important for immune function and wound healing"
  },
  selenium: {
    value: 0,
    unit: 'mcg',
    femaleAdjust: 1.0,
    description: "Antioxidant that helps protect cells from damage"
  },
  copper: {
    value: 0,
    unit: 'mg',
    femaleAdjust: 1.0,
    description: "Important for red blood cell formation and nerve function"
  },
  vitamin_b1: {
    value: 0,
    unit: 'mg',
    femaleAdjust: 0.92, // 1.1/1.2
    description: "Essential for energy metabolism"
  },
  vitamin_b2: {
    value: 0,
    unit: 'mg',
    femaleAdjust: 0.85, // 1.1/1.3
    description: "Important for energy production and cell function"
  },
  vitamin_b3: {
    value: 0,
    unit: 'mg',
    femaleAdjust: 0.88, // 14/16
    description: "Helps convert food into energy"
  }
};


// Enhanced Macronutrient Chart
const baseRDA = {
  calories: {
    value: 2000, // Base calorie recommendation
    unit: 'kcal',
    description: 'Total daily energy intake',
  },
  protein: {
    value: 50, // Base protein recommendation in grams
    unit: 'g',
    description: 'Essential for tissue repair and immune function',
    percentOfCalories: 20, // Approximate percentage of total calories
  },
  carbs: {
    value: 250, // Base carbohydrate recommendation in grams
    unit: 'g',
    description: 'Primary energy source for the body',
    percentOfCalories: 50, // Approximate percentage of total calories
  },
  fat: {
    value: 67, // Base fat recommendation in grams
    unit: 'g',
    description: 'Essential for hormone production and nutrient absorption',
    percentOfCalories: 30, // Approximate percentage of total calories
  },
  
  // Additional guidance for Long COVID
  longCovid: {
    proteinIncrease: 1.2, // Multiply base protein by this factor
    carbAdjustment: 0.9, // Slightly reduce carbs
    fatQualityNotes: 'Focus on omega-3 rich sources and minimize inflammatory omega-6 sources',
    antiInflammatoryFoods: [
      'Fatty fish (salmon, mackerel)',
      'Berries (blueberries, strawberries)',
      'Leafy greens',
      'Nuts (especially walnuts)',
      'Olive oil',
      'Turmeric',
      'Ginger'
    ],
    foodsToLimit: [
      'Processed foods',
      'Added sugars',
      'Refined carbohydrates',
      'Processed vegetable oils',
      'Excessive alcohol'
    ]
  }
};
const calculatePersonalizedMacroRDA = (baseRDA, userData) => {
  // Create a deep copy of the base RDA macronutrients
  const personalRDA = JSON.parse(JSON.stringify(baseRDA));
  
  // Calculate BMR (Basal Metabolic Rate) using Mifflin-St Jeor Equation
  const calculateBMR = () => {
    if (!userData.weight || !userData.height || !userData.age || !userData.gender) {
      return null; // Return null if required data is missing
    }
    
    const heightInCm = userData.height; // Height in cm
    const weightInKg = userData.weight; // Weight in kg
    const age = userData.age;
    const isMale = userData.gender.toLowerCase() === 'male';
    
    // Mifflin-St Jeor Equation
    let bmr = (10 * weightInKg) + (6.25 * heightInCm) - (5 * age);
    bmr = isMale ? bmr + 5 : bmr - 161;
    
    return bmr;
  };
  
  // Calculate daily calorie needs based on activity level and health status
  const calculateDailyCalories = (bmr) => {
    if (!bmr) return null;
    
    // Activity level multipliers
    const activityMultipliers = {
      sedentary: 1.2,      // Little or no exercise
      light: 1.375,        // Light exercise 1-3 days per week
      moderate: 1.55,      // Moderate exercise 3-5 days per week
      active: 1.725,       // Heavy exercise 6-7 days per week
      veryActive: 1.9      // Very heavy exercise, physical job or training twice a day
    };
    
    // Default to sedentary if activity level is not provided
    const activityLevel = userData.activityLevel || 'sedentary';
    let calorieNeeds = bmr * activityMultipliers[activityLevel];
    
    // Reduce calories for Long COVID patients due to potential decreased activity
    // and metabolic changes, unless the user is underweight
    if (userData.covid_condition && userData.bmi >= 18.5) {
      calorieNeeds *= 0.9; // 10% reduction
    }
    
    return Math.round(calorieNeeds);
  };
  
  // Calculate BMI - Weight in kg / (Height in m)²
  const calculateBMI = () => {
    if (!userData.weight || !userData.height) return null;
    
    const heightInM = userData.height / 100; // Convert cm to m
    return userData.weight / (heightInM * heightInM);
  };
  
  // Calculate macronutrient distribution based on health conditions
  const calculateMacroDistribution = (totalCalories) => {
    if (!totalCalories) return null;
    
    let proteinPct = 0.25; // Default: 25% of calories from protein
    let carbsPct = 0.45;   // Default: 45% of calories from carbs
    let fatPct = 0.3;      // Default: 30% of calories from fat
    
    // Adjust for Long COVID condition
    if (userData.covid_condition) {
      // Increase protein for recovery and immune function
      proteinPct = 0.30;
      // Decrease carbs slightly to reduce inflammation potential
      carbsPct = 0.40;
      // Keep healthy fats the same
      fatPct = 0.30;
    }
    
    // Adjust for underweight individuals
    const bmi = calculateBMI();
    if (bmi && bmi < 18.5) {
      // Higher calories from all sources
      fatPct = 0.35; // Increase fats for calorie density
      carbsPct = 0.45; // Keep carbs the same
      proteinPct = 0.20; // Maintain adequate protein
    }
    
    // Adjust for overweight individuals
    if (bmi && bmi > 30) {
      // Focus on protein for satiety
      proteinPct = 0.35;
      carbsPct = 0.35;
      fatPct = 0.30;
    }
    
    return {
      protein: proteinPct,
      carbs: carbsPct,
      fat: fatPct
    };
  };
  
  // Calculate actual macronutrient amounts in grams
  const calculateMacrosInGrams = (totalCalories, distribution) => {
    if (!totalCalories || !distribution) return null;
    
    // Calories per gram: Protein=4, Carbs=4, Fat=9
    return {
      protein: Math.round((totalCalories * distribution.protein) / 4),
      carbs: Math.round((totalCalories * distribution.carbs) / 4),
      fat: Math.round((totalCalories * distribution.fat) / 9)
    };
  };
  
  // Main calculation logic
  try {
    // Calculate BMR
    const bmr = calculateBMR();
  
    // Calculate daily calorie needs
    const dailyCalories = calculateDailyCalories(bmr);
  
    // Get macronutrient distribution
    const macroDistribution = calculateMacroDistribution(dailyCalories);
  
    // Calculate macros in grams
    const macrosInGrams = calculateMacrosInGrams(dailyCalories, macroDistribution);
  
    // Create a clone of personalRDA to safely modify it
    const updatedRDA = JSON.parse(JSON.stringify(personalRDA));
  
    if (macrosInGrams) {
      Object.keys(macrosInGrams).forEach(macro => {
        if (updatedRDA[macro]) {
          updatedRDA[macro].value = macrosInGrams[macro];
  
          // Add COVID-specific recommendations
          if (userData.covid_condition) {
            switch (macro) {
              case 'protein':
                updatedRDA[macro].covidRecommendation =
                  'Higher protein intake supports immune function and muscle repair - focus on lean sources.';
                break;
              case 'carbs':
                updatedRDA[macro].covidRecommendation =
                  'Focus on complex carbohydrates with anti-inflammatory properties like fruits, vegetables, and whole grains.';
                break;
              case 'fat':
                updatedRDA[macro].covidRecommendation =
                  'Emphasize omega-3 fatty acids to help manage inflammation associated with Long COVID.';
                break;
            }
          }
        }
      });
  
      // Add calculated calories to the result
      updatedRDA.calories = {
        value: dailyCalories,
        unit: 'kcal',
        covidRecommendation: userData.covid_condition ?
          'Monitor energy levels and adjust intake accordingly. Long COVID may affect metabolism and energy requirements.' : undefined
      };
    }
  
    return updatedRDA;
  
  } catch (error) {
    console.error('Error calculating personalized macronutrient RDA:', error);
  }
  
  
  return personalRDA;
};


// Enhanced Micronutrient Chart
// Enhanced Micronutrient Chart - Fixed implementation
// Enhanced Micronutrient Chart - Fixed implementatio

// Sample user data
const sampleUserData1 = {
  age: 30,
  gender: 'female',
  weight: 68, // kg
  height: 165, // cm
  covid_severity: 'Moderate', // 'Mild', 'Moderate', 'Severe', 'Very Severe', or null
  activity_level: 'Moderate', // 'Sedentary', 'Low', 'Moderate', 'High', 'Very High'
  pregnancy: false,
  lactating: false,
  medical_conditions: ['anemia'] // Array of conditions
};

// Comprehensive base RDA nutrient data with gender adjustments


// Sample current nutrient intake data
const sampleNutrientData1 = {
  vitamin_a: { value: 700, unit: 'mcg' },
  vitamin_c: { value: 120, unit: 'mg' },
  vitamin_d: { value: 15, unit: 'mcg' },
  vitamin_b6: { value: 1.5, unit: 'mg' },
  vitamin_b12: { value: 3.5, unit: 'mcg' },
  iron: { value: 12, unit: 'mg' },
  calcium: { value: 800, unit: 'mg' },
  magnesium: { value: 320, unit: 'mg' },
  zinc: { value: 9, unit: 'mg' },
  folate: { value: 250, unit: 'mcg' },
  vitamin_e: { value: 10, unit: 'mg' },
  selenium: { value: 40, unit: 'mcg' },
  copper: { value: 0.8, unit: 'mg' },
  vitamin_b1: { value: 1.0, unit: 'mg' },
  vitamin_b2: { value: 1.1, unit: 'mg' },
  vitamin_b3: { value: 13, unit: 'mg' }
};

// Bullet Chart Component

// Bullet Chart Component
const BulletChart = ({ data, maxPercent }) => {
  // Calculate bar widths as percentages
  const actualWidth = Math.min(100, (data.value / data.rda) * 100);
  const optimalWidth = Math.min(100, 100); // 100% RDA
  
  // Determine the color based on the percentage
  const getColor = (percent) => {
    if (percent >= 100) return "#4CAF50"; // Green
    if (percent >= 70) return "#8BC34A";  // Light green
    if (percent >= 50) return "#FFC107";  // Yellow
    if (percent >= 30) return "#FF9800";  // Orange
    return "#F44336";                     // Red
  };
  
  const barColor = getColor(actualWidth);
  
  return (
    <div className="bullet-chart">
      <div className="bullet-chart-header">
        <div className="bullet-chart-title">
          <span className="nutrient-name">{data.name}</span>
          {data.isAdjusted && (
            <span className="adjusted-badge">
              Adjusted
            </span>
          )}
        </div>
        <div className="bullet-chart-values">
          {data.value} / {data.rda} {data.unit}
          <span className="bullet-chart-percentage" style={{ color: barColor }}>
            ({Math.round(actualWidth)}%)
          </span>
        </div>
      </div>
      
      {/* Bullet chart background track */}
      <div className="bullet-chart-track">
        {/* 70% threshold marker */}
        <div 
          className="threshold-marker"
          style={{ left: '70%' }}
        ></div>
        
        {/* Actual value bar */}
        <div 
          className="actual-value-bar"
          style={{ 
            width: `${actualWidth}%`, 
            backgroundColor: barColor 
          }}
        ></div>
        
        {/* Target line (100% RDA) */}
        <div 
          className="target-line"
          style={{ left: `${optimalWidth}%` }}
        ></div>
      </div>
    </div>
  );
};
function ensureCompleteNutrientData (intakeData, baseRDAData0) {
  // Create a new object with all keys from baseRDAData
  const completeData = baseRDAData0;
  
  // First, add all nutrients from the base RDA data with null values
  Object.keys(baseRDAData0).forEach(nutrient => {
    //console.log();
  //completeData[nutrient] = null;
  });
  
  // Then, override with actual intake values where available
  Object.keys(intakeData).forEach(nutrient => {
    completeData[nutrient] = intakeData[nutrient];
  });
  
  return completeData;
};
function MicronutrientChart({ data, userData}) {
  const baseRDAData10 = {
    vitamin_a: {
      value: 900,
      unit: 'mcg',
      femaleAdjust: 0.78, // 700/900
      description: "Supports vision, immune function, and cell growth"
    },
    vitamin_c: {
      value: 90,
      unit: 'mg',
      femaleAdjust: 0.83, // 75/90
      description: "Antioxidant that supports immune function and collagen production"
    },
    vitamin_d: {
      value: 600,
      unit: 'UI',
      femaleAdjust: 1.0,
      description: "Crucial for calcium absorption and bone health"
    },
    vitamin_e: {
      value: 15,
      unit: 'mg',
      femaleAdjust: 1.0,
      description: "Antioxidant that protects cells from damage"
    },
    vitamin_b6: {
      value: 1.3,
      unit: 'mg',
      femaleAdjust: 1.0,
      description: "Important for metabolism and brain development"
    },
    vitamin_b12: {
      value: 2.4,
      unit: 'mcg',
      femaleAdjust: 1.0,
      description: "Essential for nerve function and blood cell formation"
    },
    folate: {
      value: 400,
      unit: 'mcg',
      femaleAdjust: 1.0,
      description: "Critical for cell division and DNA synthesis"
    },
    iron: {
      value: 8,
      unit: 'mg',
      femaleAdjust: 2.25, // 18/8
      description: "Essential for oxygen transport in the blood"
    },
    calcium: {
      value: 1000,
      unit: 'mg',
      femaleAdjust: 1.0,
      description: "Critical for bone health and muscle function"
    },
    magnesium: {
      value: 420,
      unit: 'mg',
      femaleAdjust: 0.76, // 320/420
      description: "Involved in over 300 biochemical reactions in the body"
    },
    zinc: {
      value: 11,
      unit: 'mg',
      femaleAdjust: 0.73, // 8/11
      description: "Important for immune function and wound healing"
    },
    selenium: {
      value: 55,
      unit: 'mcg',
      femaleAdjust: 1.0,
      description: "Antioxidant that helps protect cells from damage"
    },
    copper: {
      value: 0.9,
      unit: 'mg',
      femaleAdjust: 1.0,
      description: "Important for red blood cell formation and nerve function"
    },
    vitamin_b1: {
      value: 1.2,
      unit: 'mg',
      femaleAdjust: 0.92, // 1.1/1.2
      description: "Essential for energy metabolism"
    },
    vitamin_b2: {
      value: 1.3,
      unit: 'mg',
      femaleAdjust: 0.85, // 1.1/1.3
      description: "Important for energy production and cell function"
    },
    vitamin_b3: {
      value: 16,
      unit: 'mg',
      femaleAdjust: 0.88, // 14/16
      description: "Helps convert food into energy"
    }
  };
  //console.log(data, userData);
  const [userInfo, setUserInfo] = useState(userData);
  const [chartData, setChartData] = useState([]);
  const [nutrientIntake, setNutrientIntake] = useState(ensureCompleteNutrientData(data, baseRDAData1));
  const [personalizedRDA, setPersonalizedRDA] = useState({});
  const [displayMode, setDisplayMode] = useState('all'); // 'all', 'deficient', 'optimal'
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all', 'vitamins', 'minerals'

  useEffect(() => {
    // Simulate data loading
    setTimeout(() => {
      const calculatedRDA = calculatePersonalizedRDA(baseRDAData10, userInfo);
      setPersonalizedRDA(calculatedRDA);
      processNutrientData(nutrientIntake, calculatedRDA);
      setIsLoading(false);
    }, 500);
  }, [userInfo]);

  const calculatePersonalizedRDA = (baseRDAData_, userData) => {
    // Create a deep copy of the base RDA
    const personalRDA = JSON.parse(JSON.stringify(baseRDAData_));
    
    // Apply adjustments based on user demographics
    Object.keys(personalRDA).forEach(nutrient => {
      let adjustedValue=0;
     // console.log(personalRDA);
      try{
      // Start with base value
      adjustedValue = personalRDA[nutrient].value;
      } catch (e) {
console.log(e);
        //let adjustedValue = 1;
      }
      // Gender adjustment
      if (userData.gender && userData.gender.toLowerCase() === 'female') {
        adjustedValue *= personalRDA[nutrient].femaleAdjust;
      }
      
      // Age adjustments
      if (userData.age) {
        if (userData.age >= 70) {
          // Seniors need more vitamin D, B12, calcium
          if (nutrient === 'vitamin_d') adjustedValue *= 1.2;
          if (nutrient === 'vitamin_b12') adjustedValue *= 1.1;
          if (nutrient === 'calcium') adjustedValue *= 1.15;
        } else if (userData.age >= 50) {
          // Older adults need more vitamin D, B12
          if (nutrient === 'vitamin_d') adjustedValue *= 1.1;
          if (nutrient === 'vitamin_b12') adjustedValue *= 1.05;
        } else if (userData.age <= 18) {
          // Teens need more calcium, iron
          if (nutrient === 'calcium') adjustedValue *= 1.15;
          if (nutrient === 'iron') adjustedValue *= 1.1;
        }
      }
      
      // Weight/height adjustments (using BMI)
      if (userData.weight && userData.height) {
        // Calculate BMI (weight in kg / height in m^2)
        const heightInM = userData.height / 100; // Convert cm to m
        const bmi = userData.weight / (heightInM * heightInM);
        
        if (bmi < 18.5) {
          // Underweight - need more of many nutrients
          if (['vitamin_a', 'vitamin_c', 'vitamin_d', 'iron', 'zinc'].includes(nutrient)) {
            adjustedValue *= 1.15;
          }
        } else if (bmi > 30) {
          // Obesity - need more of certain nutrients
          if (['vitamin_d', 'magnesium', 'vitamin_e'].includes(nutrient)) {
            adjustedValue *= 1.2;
          }
        }
      }
      
      // Pregnancy and lactation adjustments
      if (userData.gender && userData.gender.toLowerCase() === 'female') {
        if (userData.pregnancy) {
          if (['folate', 'iron', 'calcium', 'vitamin_d'].includes(nutrient)) {
            adjustedValue *= 1.5;
          } else {
            adjustedValue *= 1.2; // General increase for most nutrients during pregnancy
          }
        } else if (userData.lactating) {
          if (['calcium', 'vitamin_a', 'vitamin_c', 'vitamin_b6'].includes(nutrient)) {
            adjustedValue *= 1.4;
          } else {
            adjustedValue *= 1.2; // General increase for most nutrients during lactation
          }
        }
      }
      
      // Activity level adjustments
      if (userData.activity_level) {
        const activityMultipliers = {
          'Very High': 1.2,
          'High': 1.15,
          'Moderate': 1.1,
          'Low': 1.05,
          'Sedentary': 1.0
        };
        
        const activityLevel = userData.activity_level || 'Moderate';
        const multiplier = activityMultipliers[activityLevel] || 1.0;
        
        // Apply higher requirements for certain nutrients based on activity
        if (['magnesium', 'iron', 'vitamin_b1', 'vitamin_b2', 'vitamin_b3', 'vitamin_b6'].includes(nutrient)) {
          adjustedValue *= multiplier;
        }
      }
      
      // Medical condition adjustments
      if (userData.medical_conditions && userData.medical_conditions.length > 0) {
        // Handle anemia
        if (userData.medical_conditions.includes('anemia') && 
            ['iron', 'vitamin_b12', 'folate', 'vitamin_c'].includes(nutrient)) {
          adjustedValue *= 1.5;
        }
        
        // Could add more condition adjustments here
      }

      // COVID severity adjustments
      if (userData.covid_severity) {
        // Define adjustment factors based on severity
        let covidAdjustmentFactors = {
          'Mild': {
            primary: 1.2,   // 20% increase
            secondary: 1.1  // 10% increase
          },
          'Moderate': {
            primary: 1.5,   // 50% increase
            secondary: 1.3  // 30% increase
          },
          'Severe': {
            primary: 1.8,   // 80% increase
            secondary: 1.5  // 50% increase
          },
          'Very Severe': {
            primary: 2.0,   // 100% increase
            secondary: 1.7  // 70% increase
          }
        };
        
        // Get adjustment factors for this severity
        const severityFactors = covidAdjustmentFactors[userData.covid_severity] || covidAdjustmentFactors['Moderate'];
        
        // Primary nutrients - critical for immune function
        if (['vitamin_c', 'vitamin_d', 'zinc', 'selenium'].includes(nutrient)) {
          adjustedValue *= severityFactors.primary;
        }
        
        // Secondary supporting nutrients
        if (['vitamin_a', 'vitamin_e', 'vitamin_b6', 'vitamin_b12', 'folate', 'iron'].includes(nutrient)) {
          adjustedValue *= severityFactors.secondary;
        }
        
        // Tertiary nutrients - mild increase for all severities
        if (['magnesium', 'copper', 'vitamin_b1', 'vitamin_b2', 'vitamin_b3'].includes(nutrient)) {
          adjustedValue *= 1.1; // 10% increase regardless of severity
        }
      }
      
      // *** FIX: Create a new property instead of trying to modify a potentially read-only property ***
      const roundedValue = Math.round(adjustedValue * 10) / 10;
      
      // Create a new nutrient object with updated values
      personalRDA[nutrient] = {
        ...personalRDA[nutrient],
        value: roundedValue,
        isAdjusted: roundedValue !== baseRDAData_[nutrient].value
      };
    });
    
    return personalRDA;
  };

  const processNutrientData = (intake, rdaValues) => {
    // Transform the data for the chart
    let processedData = Object.entries(intake).map(([key, details]) => {
      // Skip if no RDA value available
      if (!rdaValues[key]) return null;
      
      // Get the current intake value
      const intakeValue = typeof details === 'object' ? details.value : details;
      
      // Get the RDA value and unit
      const rdaValue = rdaValues[key].value;
      const unit = rdaValues[key].unit || 'mg';
      
      // Calculate percentage of RDA
      const percentOfRDA = (intakeValue / rdaValue) * 100;
      
      // Format the nutrient name for display
      const formattedName = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      
      // Flag if this nutrient was adjusted from standard RDA (e.g., for COVID)
      const isAdjusted = rdaValues[key].isAdjusted || false;
      
      // Calculate the standard RDA (before personalization)
      const standardRDA = baseRDAData1[key]?.value || rdaValue;
      
      // Determine if it's a vitamin or mineral
      const category = key.includes('vitamin') ? 'vitamins' : 'minerals';
      
      return {
        name: formattedName,
        key: key,
        percentOfRDA: Math.min(percentOfRDA, 150), // Cap at 150% for visualization
        fullPercent: percentOfRDA,
        value: intakeValue,
        unit: unit,
        rda: rdaValue,
        standardRDA: standardRDA,
        isAdjusted: isAdjusted,
        description: rdaValues[key].description || '',
        category: category
      };
    }).filter(item => item !== null);
    
    // Filter data based on display mode
    if (displayMode === 'deficient') {
      processedData = processedData.filter(item => item.percentOfRDA < 90);
    } else if (displayMode === 'optimal') {
      processedData = processedData.filter(item => item.percentOfRDA >= 90);
    }
    
    // Filter by category if needed
    if (selectedCategory !== 'all') {
      processedData = processedData.filter(item => item.category === selectedCategory);
    }
    
    // Sort data by percentage of RDA (ascending to show deficiencies first)
    processedData.sort((a, b) => a.percentOfRDA - b.percentOfRDA);
    
    setChartData(processedData);
  };
  
  // Get COVID severity UI classes
  const getCovidSeverityClass = (severity) => {
    switch(severity) {
      case 'Mild': return 'covid-severity-mild';
      case 'Moderate': return 'covid-severity-moderate';
      case 'Severe': return 'covid-severity-severe';
      case 'Very Severe': return 'covid-severity-very-severe';
      default: return 'covid-severity-unknown';
    }
  };
  
  // Toggle COVID severity for demonstration
  const toggleCovidSeverity = () => {
    const severities = [null, 'Mild', 'Moderate', 'Severe', 'Very Severe'];
    const currentIndex = severities.indexOf(userInfo.covid_severity);
    const nextIndex = (currentIndex + 1) % severities.length;
    
    const updatedUserInfo = {
      ...userInfo,
      covid_severity: severities[nextIndex]
    };
    
    setUserInfo(updatedUserInfo);
  };
  
  // Toggle display mode
  const changeDisplayMode = (mode) => {
    setDisplayMode(mode);
    // Recalculate chart data with the new filter
    processNutrientData(nutrientIntake, personalizedRDA);
  };
  
  // Change category filter
  const changeCategory = (category) => {
    setSelectedCategory(category);
    processNutrientData(nutrientIntake, personalizedRDA);
  };
  // Calculate the number of deficient nutrients
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p className="loading-text">Loading personalized micronutrient data...</p>
        </div>
      </div>
    );
  }

  // Calculate the number of deficient nutrients
  const deficientCount = chartData.filter(item => item.percentOfRDA < 70).length;

  return (
    <div className="micronutrient-chart-container">
      <div className="chart-card">
        <div className="chart-header">
          <h2 className="chart-title">Micronutrient Status</h2>
          
          <div className="display-mode-buttons">
            <button 
              onClick={() => changeDisplayMode('all')}
              className={`mode-button ${displayMode === 'all' ? 'mode-button-active' : ''}`}
            >
              All
            </button>
            <button 
              onClick={() => changeDisplayMode('deficient')}
              className={`mode-button ${displayMode === 'deficient' ? 'mode-button-deficient' : ''}`}
            >
              Deficient
            </button>
            <button 
              onClick={() => changeDisplayMode('optimal')}
              className={`mode-button ${displayMode === 'optimal' ? 'mode-button-optimal' : ''}`}
            >
              Optimal
            </button>
          </div>
        </div>
        
        <div className="category-filter">
          <button 
            onClick={() => changeCategory('all')}
            className={`category-button ${selectedCategory === 'all' ? 'category-button-active' : ''}`}
          >
            All Nutrients
          </button>
          <button 
            onClick={() => changeCategory('vitamins')}
            className={`category-button ${selectedCategory === 'vitamins' ? 'category-button-active' : ''}`}
          >
            Vitamins
          </button>
          <button 
            onClick={() => changeCategory('minerals')}
            className={`category-button ${selectedCategory === 'minerals' ? 'category-button-active' : ''}`}
          >
            Minerals
          </button>
        </div>
        
        {deficientCount > 0 && (
          <div className="deficiency-alert">
            <p className="deficiency-message">
              {deficientCount} {deficientCount === 1 ? 'nutrient is' : 'nutrients are'} below recommended levels.
            </p>
          </div>
        )}
        
        {userInfo.covid_severity && (
          <div className={`covid-alert ${getCovidSeverityClass(userInfo.covid_severity)}`}>
            <p className="covid-title">Long COVID Condition - {userInfo.covid_severity} Severity</p>
            <p className="covid-description">Recommended values have been adjusted for immune system support</p>
          </div>
        )}
        
        <div className="chart-content">
          {chartData.map((nutrient) => (
            <BulletChart 
              key={nutrient.key} 
              data={nutrient}
              maxPercent={150}
            />
          ))}
        </div>
        
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color legend-optimal"></div>
            <span className="legend-text">≥ 100% (Optimal)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color legend-good"></div>
            <span className="legend-text">70-99% (Good)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color legend-moderate"></div>
            <span className="legend-text">50-69% (Moderate)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color legend-low"></div>
            <span className="legend-text">30-49% (Low)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color legend-very-low"></div>
            <span className="legend-text">0-29% (Very Low)</span>
          </div>
          <div className="legend-item">
            <div className="legend-target"></div>
            <span className="legend-text">Target (100% RDA)</span>
          </div>
          <div className="legend-item">
            <div className="legend-threshold"></div>
            <span className="legend-text">Deficiency Threshold (70%)</span>
          </div>
        </div>
      </div>
      
      {/* User profile card */}
      <div className="profile-card">
        <h3 className="profile-title">User Profile</h3>
        <div className="profile-grid">
          <div className="profile-item">
            <p className="profile-label">Age</p>
            <p className="profile-value">{userInfo.age} years</p>
          </div>
          <div className="profile-item">
            <p className="profile-label">Gender</p>
            <p className="profile-value">{userInfo.gender ? userInfo.gender.charAt(0).toUpperCase() + userInfo.gender.slice(1) : 'Not specified'}</p>
          </div>
          <div className="profile-item">
            <p className="profile-label">BMI</p>
            <p className="profile-value">{userInfo.weight && userInfo.height ? 
              Math.round((userInfo.weight / Math.pow(userInfo.height/100, 2)) * 10) / 10 : 'N/A'}</p>
          </div>
          <div className="profile-item">
            <p className="profile-label">Activity Level</p>
            <p className="profile-value">{userInfo.activity_level || 'Not specified'}</p>
          </div>
          <div className="profile-item">
            <p className="profile-label">Medical Conditions</p>
            <p className="profile-value">{userInfo.medical_conditions && userInfo.medical_conditions.length > 0 ? 
              userInfo.medical_conditions.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ') : 'None'}</p>
          </div>
          <div className="profile-item">
            <p className="profile-label">COVID Status</p>
            <button 
              onClick={toggleCovidSeverity} 
              className="covid-toggle-button"
            >
              {userInfo.covid_severity || 'None'} (Click to change)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
  
  

const userProfileSchema = {
  // Existing user fields...
  age: Number,
  gender: String,
  weight: Number,  // in kg
  height: Number,  // in cm
  
  // New COVID-related fields
  covid_condition: Boolean,
  covid_severity: String,  // "None", "Mild", "Moderate", "Severe", "Very Severe"
  
  // Additional useful fields for Long COVID
  primarySymptoms: [String],  // Array of primary symptoms
  symptomOnsetDate: Date,     // When symptoms began
  vaccinationStatus: String    // For potential correlation analysis
};
/*
function AnalysisTab({ foodLog, userProfile }) {
  console.log('AnalysisTab component rendered with:', { foodLog, userProfile });

  // Data processing for charts
  const getChartData = () => {
    if (foodLog.length === 0) return { calorieData: [], macroSums: {}, microSums: {}, efficiencyData: [] };

    // Get the most recent date in the food log
    const lastDate = foodLog[0].date;
    const lastDayEntries = foodLog.filter(e => e.date === lastDate);
    
    // Process data for the efficiency chart - use all entries, not just today
    const efficiencyData = foodLog.map(entry => ({
      date: entry.date,
      time: entry.time,
      mealType: entry.mealType,
      name: entry.name,
      efficiency: +entry.metabolicEfficiency || 50, // Default to 50 if not available
      calories: +entry.calories || 0
    }));
    
    // Process calorie data
    const calorieData = foodLog.map(entry => ({
      date: entry.date,
      mealType: entry.mealType,
      calories: +entry.calories || 0,
      metabolicEfficiency: +entry.metabolicEfficiency || 50 // Default to 50 if not available
    }));

    // Calculate macronutrient sums for today
    const macroSums = lastDayEntries.reduce((acc, e) => {
      acc.protein = (acc.protein || 0) + (+e.protein || 0);
      acc.carbs = (acc.carbs || 0) + (+e.carbs || 0);
      acc.fat = (acc.fat || 0) + (+e.fat || 0);
      return acc;
    }, {});

    // Calculate micronutrient sums for today
    const microSums = lastDayEntries.reduce((acc, e) => {
      if (e.micronutrients) {
        Object.entries(e.micronutrients).forEach(([k, v]) => {
          if (!['protein','carbs','fat','calories','name','unit'].includes(k)) {
            acc[k] = (acc[k] || 0) + (+v.value || 0);
          }
        });
      }
      return acc;
    }, {});

    return { calorieData, macroSums, microSums, efficiencyData };
  };



  const { calorieData, macroSums, microSums, efficiencyData } = getChartData();
  const today = new Date().toISOString().slice(0, 10);
  const todayDate = foodLog.length > 0 ? foodLog[0].date : today;

  // Handler for severity changes from the selector component
  const handleSeverityChange = ({ severity, hasCovidCondition }) => {
    // This would update the user profile in your app state or database
    console.log("COVID severity updated:", severity, hasCovidCondition);
    
    // Example of how you might update user profile in real application:
    // updateUserProfile({
    //   covid_condition: hasCovidCondition,
    //   covid_severity: severity
    // });
  };
//console.log(JSON.stringify(efficiencyData));
//console.log(JSON.stringify(macroSums));
  return (
    <div className="food-analysis-section">
   
      
      {/* Add COVID Severity Selector to the top of the

 {/* Add COVID Severity Selector to the top of the Analysis Tab   <CovidNutrientRecommendations 
          severity={userProfile.covid_severity}
          currentIntake={microSums}
        />  <div className="chart-container"> </div>  <FoodEfficiencyTable 
        data={efficiencyData} 
        covidSeverity={userProfile.covid_severity}
      />*/
    /*}

      
     

<MacronutrientChart userData={userProfile} baseRDAdata1 userIntake={macroSums} />
  <MicronutrientChart data={microSums} userData={userProfile} />
  <EfficiencyChart data={prepareChartData(efficiencyData)} userData={userProfile} />
        {}
       
      
      
     
    </div>
  );
}*/



// Replace your AnalysisTab function in FoodTrackerAnalysis.js with this version:

/*function AnalysisTab({ foodLog, userProfile }) {
  console.log('AnalysisTab component started with:', { 
    foodLogLength: foodLog?.length, 
    userProfile: userProfile 
  });

  // Add safety check and error boundary
  if (!foodLog || !Array.isArray(foodLog)) {
    console.error('AnalysisTab: Invalid foodLog data');
    return <div>Error: Invalid food log data</div>;
  }

  if (!userProfile) {
    console.error('AnalysisTab: Missing userProfile');
    return <div>Error: User profile data missing</div>;
  }

  // Data processing for charts with enhanced error handling
  const getChartData = () => {
    try {
      console.log('Processing chart data...');
      
      if (foodLog.length === 0) {
        console.log('No food log entries found');
        return { calorieData: [], macroSums: {}, microSums: {}, efficiencyData: [] };
      }

      // Get the most recent date in the food log
      const sortedLog = [...foodLog].sort((a, b) => {
        const dateA = a.date || '1970-01-01';
        const dateB = b.date || '1970-01-01';
        return dateB.localeCompare(dateA);
      });
      
      const lastDate = sortedLog[0]?.date || new Date().toISOString().slice(0, 10);
      const lastDayEntries = foodLog.filter(e => e.date === lastDate);
      
      console.log('Last date:', lastDate, 'Entries for today:', lastDayEntries.length);
      
      // Process data for the efficiency chart - use all entries, not just today
      const efficiencyData = foodLog.map((entry, index) => {
        try {
          return {
            date: entry.date || new Date().toISOString().slice(0, 10),
            time: entry.time || '12:00 PM',
            mealType: entry.mealType || 'Unknown',
            name: entry.name || 'Unknown Food',
            efficiency: Number(entry.metabolicEfficiency) || 50,
            calories: Number(entry.calories) || 0
          };
        } catch (err) {
          console.warn(`Error processing entry ${index}:`, err);
          return {
            date: new Date().toISOString().slice(0, 10),
            time: '12:00 PM',
            mealType: 'Unknown',
            name: 'Unknown Food',
            efficiency: 50,
            calories: 0
          };
        }
      });
      
      // Process calorie data with error handling
      const calorieData = foodLog.map((entry, index) => {
        try {
          return {
            date: entry.date || new Date().toISOString().slice(0, 10),
            mealType: entry.mealType || 'Unknown',
            calories: Number(entry.calories) || 0,
            metabolicEfficiency: Number(entry.metabolicEfficiency) || 50
          };
        } catch (err) {
          console.warn(`Error processing calorie data for entry ${index}:`, err);
          return {
            date: new Date().toISOString().slice(0, 10),
            mealType: 'Unknown',
            calories: 0,
            metabolicEfficiency: 50
          };
        }
      });

      // Calculate macronutrient sums for today with enhanced error handling
      const macroSums = lastDayEntries.reduce((acc, e, index) => {
        try {
          acc.protein = (acc.protein || 0) + (Number(e.protein) || 0);
          acc.carbs = (acc.carbs || 0) + (Number(e.carbs) || 0);
          acc.fat = (acc.fat || 0) + (Number(e.fat) || 0);
          return acc;
        } catch (err) {
          console.warn(`Error processing macros for entry ${index}:`, err);
          return acc;
        }
      }, { protein: 0, carbs: 0, fat: 0 });

      // Calculate micronutrient sums for today with enhanced error handling
      const microSums = lastDayEntries.reduce((acc, e, index) => {
        try {
          if (e.micronutrients && typeof e.micronutrients === 'object') {
            Object.entries(e.micronutrients).forEach(([k, v]) => {
              try {
                if (!['protein','carbs','fat','calories','name','unit'].includes(k)) {
                  let value = 0;
                  
                  if (v && typeof v === 'object' && v.value !== undefined) {
                    value = Number(v.value) || 0;
                  } else {
                    value = Number(v) || 0;
                  }
                  
                  if (!isNaN(value) && value > 0) {
                    acc[k] = (acc[k] || 0) + value;
                  }
                }
              } catch (innerErr) {
                console.warn(`Error processing micronutrient ${k}:`, innerErr);
              }
            });
          }
          return acc;
        } catch (err) {
          console.warn(`Error processing micronutrients for entry ${index}:`, err);
          return acc;
        }
      }, {});

      console.log('Chart data processed successfully:', {
        calorieDataLength: calorieData.length,
        macroSums,
        microSumsKeys: Object.keys(microSums),
        efficiencyDataLength: efficiencyData.length
      });

      return { calorieData, macroSums, microSums, efficiencyData };
    } catch (err) {
      console.error('Error in getChartData:', err);
      // Return safe default data
      return { 
        calorieData: [], 
        macroSums: { protein: 0, carbs: 0, fat: 0 }, 
        microSums: {}, 
        efficiencyData: [] 
      };
    }
  };

  try {
    const { calorieData, macroSums, microSums, efficiencyData } = getChartData();
    const today = new Date().toISOString().slice(0, 10);
    const todayDate = foodLog.length > 0 ? foodLog[0].date : today;

    console.log('Rendering analysis with data:', {
      macroSums,
      microSumsKeys: Object.keys(microSums),
      efficiencyDataLength: efficiencyData.length
    });

    return (
      <div className="food-analysis-section">
        <div className="analysis-header">
          <h3>Nutritional Analysis for {todayDate}</h3>
          <p>Data from {foodLog.length} logged meals</p>
        </div>

        {/* Render each chart in a try-catch wrapper *//*}
        <div className="charts-container">
          
          {/* Macronutrient Chart *//*}
          <div className="chart-section">
            <h4>Macronutrient Balance</h4>
            {(() => {
              try {
                return (
                  <MacronutrientChart 
                    userData={userProfile} 
                    userIntake={macroSums} 
                  />
                );
              } catch (err) {
                console.error('Error rendering MacronutrientChart:', err);
                return (
                  <div className="chart-error">
                    <p>Error loading macronutrient chart: {err.message}</p>
                    <p>Macro data: {JSON.stringify(macroSums)}</p>
                  </div>
                );
              }
            })()}
          </div>

          {/* Micronutrient Chart *//*}
          <div className="chart-section">
            <h4>Micronutrient Status</h4>
            {(() => {
              try {
                return (
                  <MicronutrientChart 
                    data={microSums} 
                    userData={userProfile} 
                  />
                );
              } catch (err) {
                console.error('Error rendering MicronutrientChart:', err);
                return (
                  <div className="chart-error">
                    <p>Error loading micronutrient chart: {err.message}</p>
                    <p>Micro data keys: {Object.keys(microSums).join(', ')}</p>
                  </div>
                );
              }
            })()}
          </div>

          {/* Efficiency Chart *//*}
          <div className="chart-section">
            <h4>Metabolic Efficiency</h4>
            {(() => {
              try {
                return (
                  <EfficiencyChart 
                    data={prepareChartData(efficiencyData)} 
                    userData={userProfile} 
                  />
                );
              } catch (err) {
                console.error('Error rendering EfficiencyChart:', err);
                return (
                  <div className="chart-error">
                    <p>Error loading efficiency chart: {err.message}</p>
                    <p>Efficiency data length: {efficiencyData.length}</p>
                  </div>
                );
              }
            })()}
          </div>

        </div>
      </div>
    );

  } catch (err) {
    console.error('Error in AnalysisTab render:', err);
    return (
      <div className="analysis-error">
        <h3>Analysis Error</h3>
        <p>There was an error processing your nutrition data:</p>
        <p><strong>{err.message}</strong></p>
        <p>Food log entries: {foodLog?.length || 0}</p>
        <p>User profile: {userProfile ? 'Present' : 'Missing'}</p>
        <details>
          <summary>Debug Info</summary>
          <pre>{JSON.stringify({ foodLog: foodLog?.slice(0, 2), userProfile }, null, 2)}</pre>
        </details>
      </div>
    );
  }
}*/

// Also add these CSS styles to your FoodTrackerPage.css:
/*
.food-analysis-section {
  padding: 20px;
}

.analysis-header {
  margin-bottom: 30px;
  text-align: center;
}

.charts-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.chart-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border: 1px solid #e0e0e0;
}

.chart-section h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 10px;
}

.chart-error {
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  padding: 15px;
  color: #856404;
}

.analysis-error {
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  padding: 20px;
  color: #721c24;
  margin: 20px;
}

.analysis-error details {
  margin-top: 15px;
}

.analysis-error pre {
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
}


*/

// TEMPORARILY replace your AnalysisTab function with this debug version to see what's happening:

// REPLACE your AnalysisTab function with this MINIMAL version first:

 // Replace your AnalysisTab function with this restored version:

// Replace your AnalysisTab with this version that tests each chart individually:

// Final clean version of AnalysisTab - replace your current one with this:

// Complete corrected AnalysisTab function with proper getChartData implementation

// Complete corrected AnalysisTab function with proper getChartData implementation

function AnalysisTab({ foodLog, userProfile }) {
  // Safety checks
  if (!foodLog || !Array.isArray(foodLog)) {
    return (
      <div className="analysis-error">
        <h3>Data Error</h3>
        <p>Unable to load food log data. Please try refreshing the page.</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="analysis-error">
        <h3>Profile Error</h3>
        <p>User profile data is missing. Please check your account settings.</p>
      </div>
    );
  }

  // Data processing for charts - Complete implementation
  const getChartData = () => {
    if (foodLog.length === 0) return { calorieData: [], macroSums: {}, microSums: {}, efficiencyData: [] };

    // Get the most recent date in the food log
    const lastDate = foodLog[0].date;
    const lastDayEntries = foodLog.filter(e => e.date === lastDate);
    
    // Process data for the efficiency chart - use all entries, not just today
    const efficiencyData = foodLog.map(entry => ({
      date: entry.date,
      time: entry.time,
      mealType: entry.mealType,
      name: entry.name,
      efficiency: +entry.metabolicEfficiency || 50,
      calories: +entry.calories || 0
    }));
    
    // Process calorie data
    const calorieData = foodLog.map(entry => ({
      date: entry.date,
      mealType: entry.mealType,
      calories: +entry.calories || 0,
      metabolicEfficiency: +entry.metabolicEfficiency || 50
    }));

    // Calculate macronutrient sums for the most recent day
    const macroSums = lastDayEntries.reduce((acc, e) => {
      acc.protein = (acc.protein || 0) + (+e.protein || 0);
      acc.carbs = (acc.carbs || 0) + (+e.carbs || 0);
      acc.fat = (acc.fat || 0) + (+e.fat || 0);
      return acc;
    }, {});

    // Calculate micronutrient sums for the most recent day
    const microSums = lastDayEntries.reduce((acc, e) => {
      if (e.micronutrients) {
        Object.entries(e.micronutrients).forEach(([k, v]) => {
          if (!['protein','carbs','fat','calories','name','unit'].includes(k)) {
            acc[k] = (acc[k] || 0) + (+v.value || 0);
          }
        });
      }
      return acc;
    }, {});

    return { calorieData, macroSums, microSums, efficiencyData };
  };

  // Calculate all necessary variables in the correct order
  const today = new Date().toISOString().slice(0, 10);
  const analysisDate = foodLog.length > 0 ? foodLog[0].date : today;
  const uniqueDates = [...new Set(foodLog.map(entry => entry.date))].length;
  
  // Calculate meals for actual today's date
  const todayMeals = foodLog.filter(entry => entry.date === today);
  
  // Calculate meals for the analysis date (most recent date with data)
  const analysisDateMeals = foodLog.filter(entry => entry.date === analysisDate);
  
  // Get chart data
  const { calorieData, macroSums, microSums, efficiencyData } = getChartData();

  return (
    <div className="food-analysis-section">
      <div className="analysis-header">
        <h3>📊 Nutritional Analysis Dashboard</h3>
        <p className="analysis-date">Analysis for {analysisDate}</p>
        <div className="analysis-summary">
          <span className="summary-stat">
            <strong>{todayMeals.length}</strong> meals logged today ({today})
          </span>

        </div>
      </div>

      <div className="charts-container">
        
        {/* Macronutrient Chart */}
        <div className="chart-wrapper">
          <div className="chart-header">
            <h4>🍎 Macronutrient Balance</h4>
            <p className="chart-description">Your protein, carbohydrate, and fat intake compared to personalized recommendations</p>
          </div>
          <MacronutrientChart userData={userProfile} userIntake={macroSums} />
        </div>
        
        {/* Micronutrient Chart */}
        <div className="chart-wrapper">
          <div className="chart-header">
            <h4>💊 Micronutrient Status</h4>
            <p className="chart-description">Essential vitamins and minerals as percentage of recommended daily amounts</p>
          </div>
          <MicronutrientChart data={microSums} userData={userProfile} />
        </div>
        
        {/* Efficiency Chart */}
        <div className="chart-wrapper">
          <div className="chart-header">
            <h4>⚡ Metabolic Efficiency</h4>
            <p className="chart-description">How effectively your body converts food calories into usable energy</p>
          </div>
          <EfficiencyChart data={prepareChartData(efficiencyData)} userData={userProfile} />
        </div>

      </div>

      {/* Analysis Insights */}
      <div className="analysis-insights">
        <h4>🔍 Key Insights</h4>
        <div className="insights-grid">
          <div className="insight-card">
            <h5>Analysis Date Macros</h5>
            <p>Protein: <strong>{Math.round(macroSums.protein || 0)}g</strong> | 
               Carbs: <strong>{Math.round(macroSums.carbs || 0)}g</strong> | 
               Fat: <strong>{Math.round(macroSums.fat || 0)}g</strong></p>
          </div>
          
          <div className="insight-card">
            <h5>Tracking Progress</h5>
            <p>You've logged <strong>{foodLog.length} meals</strong> with detailed nutritional data. 
               {userProfile.longCovid ? ' Recommendations are adjusted for Long COVID recovery.' : ''}</p>
          </div>
          
          <div className="insight-card">
            <h5>Micronutrient Coverage</h5>
            <p>Tracking <strong>{Object.keys(microSums).length} essential nutrients</strong> to ensure optimal health and recovery.</p>
          </div>
        </div>
      </div>
    </div>
  );
}


// Step 6: Add symptom tracking functionality for Long COVID patients

function MacronutrientChart({ userData, userIntake = {} }) {
  const chartRef = useRef(null);
  const [personalizedRDA, setPersonalizedRDA] = useState(null);
  
  // Calculate personalized RDA based on comprehensive user data
  useEffect(() => {
    if (userData) {
      const rda = calculatePersonalizedRDA(userData);
      setPersonalizedRDA(rda);
    }
  }, [userData]);
  
  // Function to calculate BMI
  const calculateBMI = (weight, height) => {
    if (!weight || !height) return null;
    // BMI = weight(kg) / height(m)²
    return weight / Math.pow(height / 100, 2);
  };
  
  // Calculate TDEE (Total Daily Energy Expenditure)
  const calculateTDEE = (userData) => {
    const { age, gender, weight, height, activity_level } = userData;
    
    if (!age || !weight || !height) {
      // Default to 2000 calories if missing data
      return 2000;
    }
    
    // Calculate BMR using Mifflin-St Jeor Equation
    let bmr;
    if (gender === 'female') {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    } else {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    }
    
    // Activity multipliers
    const activityFactors = {
      'sedentary': 1.2,      // Little or no exercise
      'light': 1.375,        // Light exercise 1-3 days/week
      'moderate': 1.55,      // Moderate exercise 3-5 days/week
      'very': 1.725,         // Heavy exercise 6-7 days/week
      'extreme': 1.9         // Very heavy exercise, physical job or training twice/day
    };
    
    const activityMultiplier = activityFactors[activity_level] || 1.375;
    
    // Calculate TDEE
    let tdee = bmr * activityMultiplier;
    
    // Adjustments for specific conditions
    if (userData.covid_condition) {
      // Increased needs during recovery - literature suggests 5-10% increase
      tdee *= 1.07; // 7% increase
    }
    
    // BMI-based adjustments
    const bmi = calculateBMI(weight, height);
    if (bmi) {
      if (bmi < 18.5) {
        // Underweight: increase calories for weight gain
        tdee *= 1.1;
      } else if (bmi > 30) {
        // Obese: slight reduction for weight management
        tdee *= 0.9;
      }
    }
    
    return Math.round(tdee);
  };
  
  // Function to calculate personalized RDA based on user factors
  const calculatePersonalizedRDA = (userData) => {
    // Calculate total calorie needs
    const totalCalories = calculateTDEE(userData);
    
    // Calculate macronutrient distribution percentages
    const macroDistribution = calculateMacroDistribution(totalCalories, userData);
    
    // Calculate grams of each macronutrient
    const protein = (totalCalories * macroDistribution.protein / 4).toFixed(1);  // 4 cal/g
    const carbs = (totalCalories * macroDistribution.carbs / 4).toFixed(1);      // 4 cal/g
    const fat = (totalCalories * macroDistribution.fat / 9).toFixed(1);          // 9 cal/g
    
    // Generate specific notes for Long COVID
    const covidNotes = {
      protein: 'Increased to support immune function and tissue repair',
      carbs: 'Focus on complex carbs with anti-inflammatory properties',
      fat: 'Higher proportion of omega-3s recommended to reduce inflammation'
    };
    
    return {
      protein: { 
        value: parseFloat(protein),
        covidNote: userData.covid_condition ? covidNotes.protein : null
      },
      carbs: { 
        value: parseFloat(carbs),
        covidNote: userData.covid_condition ? covidNotes.carbs : null
      },
      fat: { 
        value: parseFloat(fat),
        covidNote: userData.covid_condition ? covidNotes.fat : null
      },
      calories: {
        value: totalCalories
      }
    };
  };
  
  // Calculate macronutrient distribution based on user factors
  const calculateMacroDistribution = (totalCalories, userData) => {
    if (!totalCalories) return null;
    
    let proteinPct = 0.25; // Default: 25% of calories from protein
    let carbsPct = 0.45;   // Default: 45% of calories from carbs
    let fatPct = 0.3;      // Default: 30% of calories from fat
    
    // Adjust for Long COVID condition
    if (userData.covid_condition) {
      // Increase protein for recovery and immune function
      proteinPct = 0.30;
      // Decrease carbs slightly to reduce inflammation potential
      carbsPct = 0.40;
      // Keep healthy fats the same
      fatPct = 0.30;
    }
    
    // Adjust for underweight individuals
    const bmi = calculateBMI(userData.weight, userData.height);
    if (bmi && bmi < 18.5) {
      // Higher calories from all sources
      fatPct = 0.35; // Increase fats for calorie density
      carbsPct = 0.45; // Keep carbs the same
      proteinPct = 0.20; // Maintain adequate protein
    }
    
    // Adjust for overweight individuals
    if (bmi && bmi > 30) {
      // Focus on protein for satiety
      proteinPct = 0.35;
      carbsPct = 0.35;
      fatPct = 0.30;
    }
    
    // Age-related adjustments
    if (userData.age > 65) {
      // Older adults need more protein to prevent sarcopenia
      proteinPct = Math.min(proteinPct + 0.05, 0.40);
      // Adjust other macros to compensate
      const remaining = 1.0 - proteinPct;
      carbsPct = remaining * (carbsPct / (carbsPct + fatPct));
      fatPct = remaining * (fatPct / (carbsPct + fatPct));
    }
    
    return {
      protein: proteinPct,
      carbs: carbsPct,
      fat: fatPct
    };
  };

  // Create chart when data is available
  useEffect(() => {
    if (!chartRef.current || !personalizedRDA || !userIntake) return;
    
    // Clear previous chart
    d3.select(chartRef.current).selectAll("*").remove();
    
    // Set up dimensions
    const margin = { top: 40, right: 180, bottom: 60, left: 70 };
    const width = 700 - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;
    
    // Create SVG element
    const svg = d3.select(chartRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
      
    // Prepare data for stacked bar chart
    const macros = ['protein', 'carbs', 'fat'];
    const data = [
      { name: "Current Intake", ...userIntake },
      { name: "Recommended", 
        protein: personalizedRDA.protein.value,
        carbs: personalizedRDA.carbs.value,
        fat: personalizedRDA.fat.value
      }
    ];
    
    // Color scheme
    const colors = {
      protein: "#22c55e", // green
      carbs: "#3b82f6",   // blue
      fat: "#f59e0b"      // amber/orange
    };
    
    // X scale
    const x = d3.scaleBand()
      .domain(data.map(d => d.name))
      .range([0, width])
      .padding(0.3);
    
    // Y scale (for stacked bars)
    const maxValue = d3.max(data, d => {
      return d.protein + d.carbs + d.fat;
    });
    
    const y = d3.scaleLinear()
      .domain([0, maxValue * 1.1]) // Add 10% headroom
      .range([height, 0]);
    
    // Add X axis
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("font-size", "12px")
      .attr("font-weight", d => d === "Recommended" ? "bold" : "normal");
    
    // Add Y axis
    svg.append("g")
      .call(d3.axisLeft(y).ticks(5))
      .selectAll("text")
      .attr("font-size", "12px");
    
    // Y axis label
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 20)
      .attr("x", -height / 2)
      .attr("font-size", "14px")
      .attr("text-anchor", "middle")
      .attr("fill", "#666")
      .text("Grams");
    
    // Get current date formatted as MMM DD, YYYY
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    // Title with date
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -margin.top / 2)
      .attr("text-anchor", "middle")
      .attr("font-size", "16px")
      .attr("font-weight", "bold")
      .attr("fill", "#333")
      .text(`Long COVID Macronutrient Analysis - ${formattedDate}`);
    
    // Create stacked data
    data.forEach(d => {
      let y0 = 0;
      d.stackedData = macros.map(nutrient => {
        return {
          nutrient,
          y0,
          y1: y0 += (d[nutrient] || 0)
        };
      });
    });
    
    // Create tooltip
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "d3-tooltip")
      .style("position", "absolute")
      .style("background-color", "white")
      .style("border", "1px solid #ddd")
      .style("border-radius", "4px")
      .style("padding", "8px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
      .style("z-index", 100);
    
    // Create bars for each group
    const groups = svg.selectAll(".bar-group")
      .data(data)
      .join("g")
      .attr("class", "bar-group")
      .attr("transform", d => `translate(${x(d.name)},0)`);
    
    // Add bars for each nutrient in each group
    groups.selectAll("rect")
      .data(d => d.stackedData)
      .join("rect")
      .attr("width", x.bandwidth())
      .attr("y", d => y(d.y1))
      .attr("height", d => y(d.y0) - y(d.y1))
      .attr("fill", d => colors[d.nutrient])
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .on("mouseover", function(event, d) {
        const parentData = d3.select(this.parentNode).datum();
        const amount = parentData[d.nutrient].toFixed(1);
        const percentage = ((parentData[d.nutrient] / (parentData.protein + parentData.carbs + parentData.fat)) * 100).toFixed(1);
        
        // Calculate calories
        const caloriesPerGram = d.nutrient === 'fat' ? 9 : 4;
        const calories = (parentData[d.nutrient] * caloriesPerGram).toFixed(0);
        
        // COVID note if applicable
        const covidNote = parentData.name === "Recommended" && 
                        personalizedRDA[d.nutrient].covidNote ? 
                        `<br><span style="color:#6366f1;font-style:italic">${personalizedRDA[d.nutrient].covidNote}</span>` : '';
        
        tooltip
          .style("opacity", 1)
          .html(`
            <div style="font-weight:bold;text-transform:capitalize;color:${colors[d.nutrient]}">${d.nutrient}</div>
            <div style="margin:4px 0">
              <b>Amount:</b> ${amount}g
              <br><b>Percentage:</b> ${percentage}%
              <br><b>Calories:</b> ${calories} kcal
              ${covidNote}
            </div>
          `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
          
        // Highlight the hovered bar
        d3.select(this)
          .attr("stroke", "#333")
          .attr("stroke-width", 2);
      })
      .on("mouseout", function() {
        tooltip.style("opacity", 0);
        d3.select(this)
          .attr("stroke", "white")
          .attr("stroke-width", 1);
      });
    
    // Add legend
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width + 20}, 0)`);
    
    macros.forEach((nutrient, i) => {
      const legendRow = legend.append("g")
        .attr("transform", `translate(0, ${i * 25})`);
        
      legendRow.append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", colors[nutrient]);
        
      legendRow.append("text")
        .attr("x", 24)
        .attr("y", 12)
        .attr("text-anchor", "start")
        .style("text-transform", "capitalize")
        .style("font-size", "14px")
        .text(nutrient);
    });
    
    // Add COVID modifier note if applicable
    if (userData?.covid_condition) {
      svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("font-style", "italic")
        .attr("fill", "#6366f1")
        .text("Note: RDA values adjusted for Long COVID recovery needs");
    }
    
    // Calculate and display total calories
    const calculateCalories = (data) => {
      return (data.protein * 4 + data.carbs * 4 + data.fat * 9).toFixed(0);
    };
    
    // Add calorie information
    const calorieInfo = svg.append("g")
      .attr("class", "calorie-info")
      .attr("transform", `translate(${width + 20}, ${macros.length * 25 + 20})`);
      
    calorieInfo.append("text")
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .text("Total Calories:");
      
    calorieInfo.append("text")
      .attr("y", 25)
      .attr("font-size", "14px")
      .text(`Intake: ${calculateCalories(userIntake)} kcal`);
      
    calorieInfo.append("text")
      .attr("y", 50)
      .attr("font-size", "14px")
      .text(`Recommended: ${personalizedRDA.calories.value.toFixed(0)} kcal`);
    
    // Clean up function
    return () => {
      d3.select(".d3-tooltip").remove();
    };
  }, [chartRef, personalizedRDA, userIntake]);

  // Component content
  return (
    <div className="w-full">
      <div 
        ref={chartRef} 
        className="macro-chart mx-auto overflow-visible"
        style={{ minHeight: "350px" }}
      ></div>
    </div>
  );




};


/*function EfficiencyChart({ data, userData }) {
  const chartRef = useRef(null);
  const [processedData, setProcessedData] = useState([]);
  
  // Process data to include personalized metabolic efficiency
  useEffect(() => {
    if (!data || data.length === 0) return;
    
    // Process meals with personalized efficiency calculations
    const updatedData = data.map(meal => {
      // Default to 80% if no efficiency is provided
      const efficiency = meal.efficiency || 80;
      return {
        ...meal,
        originalEfficiency: efficiency,
        efficiency: efficiency,
        // Calculate actual energy value with adjusted efficiency
        actualEnergy: meal.calories * (efficiency / 100),
        wastedEnergy: meal.calories * ((100 - efficiency) / 100)
      };
    });
    
    setProcessedData(updatedData);
  }, [data, userData]);
  
  useEffect(() => {
    if (!chartRef.current || !processedData || processedData.length === 0) return;
    
    // Clear previous chart
    d3.select(chartRef.current).selectAll("*").remove();
    
    // Set dimensions
    const margin = { top: 60, right: 120, bottom: 120, left: 70 };
    const width = 800 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(chartRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Chart title
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -30)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .style("font-weight", "bold")
      .text("Metabolic Efficiency & Energy Utilization");
    
    // Create tooltip
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "chart-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "white")
      .style("border", "1px solid #ddd")
      .style("border-radius", "3px")
      .style("padding", "12px")
      .style("font-size", "14px")
      .style("box-shadow", "0 2px 8px rgba(0,0,0,0.2)")
      .style("z-index", "10");
    
    // First, sort all meals by time (regardless of date)
    // This will establish our standard meal order by time of day
    const allMealTimes = [...new Set(processedData.map(d => d.time))];
    allMealTimes.sort(); // Sort times chronologically
    
    // Create a mapping of time to mealType to ensure consistency
    const timeToMealType = {};
    processedData.forEach(d => {
      if (!timeToMealType[d.time]) {
        timeToMealType[d.time] = d.mealType;
      }
    });
    
    // Get unique meal types in time order
    const uniqueMealTypes = allMealTimes.map(time => timeToMealType[time]);
    
    // Group data by date and meal type to combine multiple meals of same type on same day
    const combinedData = [];
    
    // First group by date
    const groupedByDate = d3.group(processedData, d => d.date);
    
    // Sort dates chronologically
    const sortedDates = Array.from(groupedByDate.keys()).sort();
    
    // For each date, group meals by meal type and combine their values
    sortedDates.forEach(date => {
      const dateData = groupedByDate.get(date);
      const mealsByType = d3.group(dateData, d => d.mealType);
      
      // For each meal type, combine all meals of that type for this date
      mealsByType.forEach((meals, mealType) => {
        // Calculate total calories
        const totalCalories = d3.sum(meals, d => d.calories);
        
        // Calculate weighted efficiency based on calorie contribution
        const weightedEfficiency = meals.reduce((acc, meal) => {
          return acc + (meal.efficiency * meal.calories / totalCalories);
        }, 0);
        
        // Calculate total actual energy and wasted energy
        const totalActualEnergy = d3.sum(meals, d => d.actualEnergy);
        const totalWastedEnergy = totalCalories - totalActualEnergy;
        
        // Create a combined meal entry
        combinedData.push({
          date: date,
          mealType: mealType,
          time: meals[0].time, // Use time from first meal as reference
          name: `${mealType} (${meals.length} items)`,
          efficiency: Math.round(weightedEfficiency),
          calories: totalCalories,
          actualEnergy: totalActualEnergy,
          wastedEnergy: totalWastedEnergy,
          originalMeals: meals // Keep original meals for detailed tooltip
        });
      });
    });
    
    const sortedCombinedData = [...combinedData].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time); // assumes time is in HH:MM (24-hour format)
    });

    // Get unique dates
    const uniqueDates = sortedDates;
    
    // Calculate x scales for outer (dates) and inner (meal types) bands
    const xOuter = d3.scaleBand()
      .domain(uniqueDates)
      .range([0, width])
      .padding(0.2);
    
    const xInner = d3.scaleBand()
      .domain(uniqueMealTypes) // Using meal types sorted by time
      .range([0, xOuter.bandwidth()])
      .padding(0.1);
    
    // Format date labels - just show MM/DD
    const formatDate = date => {
      const parts = date.split('-');
      return `${parts[1]}/${parts[2]}`;
    };
    
    // y scale for calories - use exact max without padding for accurate representation
    const maxCalories = d3.max(combinedData, d => d.calories);
    const y = d3.scaleLinear()
      .domain([0, maxCalories])
      .range([height, 0]);

    // y scale for efficiency - use fixed range 50-100% for consistency
    const yEff = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0]);

    // Create axes
    const xAxis = svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xOuter).tickFormat(formatDate))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

    // Add y-axis for calories (left)
    svg.append("g")
      .call(d3.axisLeft(y))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -50)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#000")
      .text("Calories");

    // Add y-axis for efficiency (right)
    svg.append("g")
      .attr("transform", `translate(${width}, 0)`)
      .call(d3.axisRight(yEff))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 50)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#000")
      .text("Metabolic Efficiency (%)");

    // Define colors for meal types
    const mealColors = {
      "Breakfast": "#FF9F1C",  // Orange
      "Lunch": "#2EC4B6",      // Teal
      "Dinner": "#E71D36",     // Red
      "Snack": "#011627",      // Dark blue
      "Pre-workout": "#9381FF", // Purple
      "Post-workout": "#B8F2E6" // Light teal
    };

    // Default color for undefined meal types
    const defaultColor = "#999999";

    // First, add total calorie bars (stacked)
    combinedData.forEach(meal => {
      const mealColor = mealColors[meal.mealType] || defaultColor;
      const barX = xOuter(meal.date) + xInner(meal.mealType);
      const barWidth = xInner.bandwidth();
      
      // 1. Add the total calorie bar first (grey, representing wasted energy)
      svg.append("rect")
        .attr("class", "total-calorie-bar")
        .attr("x", barX)
        .attr("y", y(meal.calories))
        .attr("width", barWidth)
        .attr("height", height - y(meal.calories))
        .attr("fill", "#d0d0d0") // Grey for wasted energy
        .attr("opacity", 0.9)
        .attr("stroke", "#333")
        .attr("stroke-width", 1)
        .on("mouseover", function(event) {
          d3.select(this).attr("opacity", 0.7);
          tooltip
            .style("visibility", "visible")
            .html(`
              <div style="font-weight:bold;margin-bottom:10px;">${meal.date} - ${meal.mealType}</div>
              <div style="margin-bottom:6px;">Total Calories: ${Math.round(meal.calories)}</div>
              <div style="margin-bottom:6px;">Utilized Energy: ${Math.round(meal.actualEnergy)} cal (${meal.efficiency}%)</div>
              <div style="margin-bottom:12px;">Wasted Energy: ${Math.round(meal.wastedEnergy)} cal (${100 - meal.efficiency}%)</div>
              <div style="font-weight:bold;margin-bottom:5px;">Individual Items:</div>
              <ul style="margin-top:0;padding-left:20px;">
                ${meal.originalMeals.map(item => `
                  <li>${item.name} - ${item.calories} cal</li>
                `).join('')}
              </ul>
            `)
            .style("left", `${event.pageX + 15}px`)
            .style("top", `${event.pageY - 10}px`);
        })
        .on("mouseout", function() {
          d3.select(this).attr("opacity", 0.9);
          tooltip.style("visibility", "hidden");
        });
      
      // 2. Add the utilized energy bar on top (colored, representing actual energy)
      svg.append("rect")
        .attr("class", "utilized-energy-bar")
        .attr("x", barX)
        .attr("y", y(meal.actualEnergy))
        .attr("width", barWidth)
        .attr("height", height - y(meal.actualEnergy))
        .attr("fill", mealColor)
        .attr("opacity", 0.9)
        .attr("stroke", "#333")
        .attr("stroke-width", 1)
        .on("mouseover", function(event) {
          d3.select(this).attr("opacity", 0.7);
          tooltip
            .style("visibility", "visible")
            .html(`
              <div style="font-weight:bold;margin-bottom:10px;">${meal.date} - ${meal.mealType}</div>
              <div style="margin-bottom:6px;">Total Calories: ${Math.round(meal.calories)}</div>
              <div style="margin-bottom:6px;"><strong>Utilized Energy: ${Math.round(meal.actualEnergy)} cal (${meal.efficiency}%)</strong></div>
              <div style="margin-bottom:12px;">Wasted Energy: ${Math.round(meal.wastedEnergy)} cal (${100 - meal.efficiency}%)</div>
              <div style="font-weight:bold;margin-bottom:5px;">Individual Items:</div>
              <ul style="margin-top:0;padding-left:20px;">
                ${meal.originalMeals.map(item => `
                  <li>${item.name} - ${item.calories} cal</li>
                `).join('')}
              </ul>
            `)
            .style("left", `${event.pageX + 15}px`)
            .style("top", `${event.pageY - 10}px`);
        })
        .on("mouseout", function() {
          d3.select(this).attr("opacity", 0.9);
          tooltip.style("visibility", "hidden");
        });
      
      // 3. Add the dividing line between utilized and wasted energy
      svg.append("line")
        .attr("x1", barX)
        .attr("x2", barX + barWidth)
        .attr("y1", y(meal.actualEnergy))
        .attr("y2", y(meal.actualEnergy))
        .attr("stroke", "#333")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "3,3");
    });

    // Add efficiency line
    const lineGenerator = d3.line()
      .x(d => xOuter(d.date) + xInner(d.mealType) + xInner.bandwidth() / 2)
      .y(d => yEff(d.efficiency))
      .curve(d3.curveMonotoneX);
    
    svg.append("path")
      .datum(sortedCombinedData)
      .attr("fill", "none")
      .attr("stroke", "#FF5733")
      .attr("stroke-width", 3)
      .attr("d", lineGenerator);
    
    // Add efficiency points
    svg.selectAll(".efficiency-point")
      .data(combinedData)
      .enter()
      .append("circle")
      .attr("class", "efficiency-point")
      .attr("cx", d => xOuter(d.date) + xInner(d.mealType) + xInner.bandwidth() / 2)
      .attr("cy", d => yEff(d.efficiency))
      .attr("r", 5)
      .attr("fill", "#FF5733")
      .attr("stroke", "#333")
      .attr("stroke-width", 1)
      .on("mouseover", function(event, d) {
        d3.select(this).attr("r", 8);
        tooltip
          .style("visibility", "visible")
          .html(`
            <div style="font-weight:bold;font-size:16px;">${d.mealType} on ${d.date}</div>
            <div>Metabolic Efficiency: ${d.efficiency}%</div>
            <div>Factors affecting efficiency:</div>
            <ul>
              <li>Meal timing: ${d.time}</li>
              <li>Food combination</li>
              <li>Processing methods</li>
            </ul>
          `)
          .style("left", `${event.pageX + 15}px`)
          .style("top", `${event.pageY - 10}px`);
      })
      .on("mouseout", function() {
        d3.select(this).attr("r", 5);
        tooltip.style("visibility", "hidden");
      });
    
    // Add efficiency labels
    svg.selectAll(".efficiency-label")
      .data(combinedData)
      .enter()
      .append("text")
      .attr("class", "efficiency-label")
      .attr("x", d => xOuter(d.date) + xInner(d.mealType) + xInner.bandwidth() / 2)
      .attr("y", d => yEff(d.efficiency) - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("font-weight", "bold")
      .text(d => `${d.efficiency}%`);
    
    // Add legend for efficiency line
    svg.append("line")
      .attr("x1", width - 100)
      .attr("x2", width - 70)
      .attr("y1", 20)
      .attr("y2", 20)
      .attr("stroke", "#FF5733")
      .attr("stroke-width", 3);
    
    svg.append("circle")
      .attr("cx", width - 85)
      .attr("cy", 20)
      .attr("r", 5)
      .attr("fill", "#FF5733")
      .attr("stroke", "#333")
      .attr("stroke-width", 1);
    
    svg.append("text")
      .attr("x", width - 60)
      .attr("y", 24)
      .style("font-size", "12px")
      .text("Efficiency (%)");
    
    // Add legend for bars
    const legendData = [
      { label: "Utilized Energy", color: "#2EC4B6" },
      { label: "Wasted Energy", color: "#d0d0d0" }
    ];
    
    svg.selectAll(".legend-rect")
      .data(legendData)
      .enter()
      .append("rect")
      .attr("x", width - 100)
      .attr("y", (d, i) => 40 + i * 20)
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", d => d.color)
      .attr("stroke", "#333")
      .attr("stroke-width", 1);
    
    svg.selectAll(".legend-text")
      .data(legendData)
      .enter()
      .append("text")
      .attr("x", width - 80)
      .attr("y", (d, i) => 52 + i * 20)
      .style("font-size", "12px")
      .text(d => d.label);
    
    // Add a horizontal grid for better readability
    svg.selectAll("grid-line")
      .data(y.ticks(5))
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", d => y(d))
      .attr("y2", d => y(d))
      .attr("stroke", "#e0e0e0")
      .attr("stroke-width", 1);
  }, [chartRef, processedData]);
  
  // If no data, show placeholder
  if (!processedData || processedData.length === 0) {
    return (
      <div className="chart-container">
        <div ref={chartRef} className="efficiency-chart">
          <div className="placeholder">
            <p>No meal data available. Please add some meals to see your metabolic efficiency chart.</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (

    <div className="chart-container">
      <div ref={chartRef} className="efficiency-chart"></div>
      <div className="chart-info">
        <h4>About Metabolic Efficiency</h4>
        <p>
          Metabolic efficiency represents how effectively your body utilizes the calories you consume.
          Higher efficiency means more energy is being absorbed and used, while lower efficiency
          indicates more energy is being wasted.
        </p>
        <p>
          Factors affecting efficiency include:
          <ul>
            <li>Food combinations</li>
            <li>Meal timing</li>
            <li>Food processing methods</li>
            <li>Individual digestive health</li>
            <li>Activity levels around meal times</li>
          </ul>
        </p>
      </div>
    </div>
  );
}*/



// TEMPORARILY replace your EfficiencyChart function with this debug version:

function EfficiencyChart({ data, userData, foodDatabase }) {
  const chartRef = useRef(null);
  const [processedData, setProcessedData] = useState([]);
  
  // Process data to include personalized metabolic efficiency
  useEffect(() => {
    if (!data || data.length === 0) return;
    
    // Filter data to only include the last week
    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);
    
    // Filter data to only include entries from the last week
    const lastWeekData = data.filter(meal => {
      try {
        const mealDate = new Date(meal.date);
        return mealDate >= oneWeekAgo;
      } catch (err) {
        console.warn('Error parsing date:', meal.date);
        return false;
      }
    });
    
    // Process meals with detailed efficiency calculations
    const updatedData = lastWeekData.map((meal, index) => {
      try {
        const efficiency = meal.efficiency || 80;
        
        return {
          ...meal,
          originalEfficiency: efficiency,
          efficiency: efficiency,
          actualEnergy: Math.round(meal.calories * (efficiency / 100)),
          wastedEnergy: Math.round(meal.calories * ((100 - efficiency) / 100))
        };
      } catch (err) {
        console.warn(`Error processing meal ${index}:`, err);
        return {
          ...meal,
          efficiency: 80,
          actualEnergy: Math.round(meal.calories * 0.8),
          wastedEnergy: Math.round(meal.calories * 0.2)
        };
      }
    });
    
    // Filter out pre-workout and post-workout entries
    const filteredData = updatedData.filter(meal => 
      meal.mealType !== "Pre-workout" && meal.mealType !== "Post-workout"
    );
    
    setProcessedData(filteredData);
  }, [data, userData, foodDatabase]);
  
  useEffect(() => {
    if (!chartRef.current || !processedData || processedData.length === 0) return;
    
    // Clear previous chart
    d3.select(chartRef.current).selectAll("*").remove();
    
    // Set dimensions
    const margin = { top: 60, right: 120, bottom: 140, left: 70 };
    const width = 800 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(chartRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Chart title
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -30)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .style("font-weight", "bold")
      .text("Metabolic Efficiency Chart");
      
    // Chart subtitle
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-style", "italic")
      .text("How efficiently your body converts food into usable energy");
    
    // Create tooltip
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "chart-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "white")
      .style("border", "1px solid #ddd")
      .style("border-radius", "5px")
      .style("padding", "12px")
      .style("font-size", "14px")
      .style("box-shadow", "0 3px 14px rgba(0,0,0,0.25)")
      .style("z-index", "10")
      .style("max-width", "300px");
    
    // Generate an array of all days in the past week (even without data)
    const allDatesInRange = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const formattedDate = date.toISOString().split('T')[0];
      allDatesInRange.push(formattedDate);
    }
    
    // Group data by date and meal type to combine multiple meals of same type on same day
    const combinedData = [];
    
    // First group by date
    const groupedByDate = d3.group(processedData, d => d.date);
    
    // Use all dates in range instead of just the ones with data
    const sortedDates = allDatesInRange;
    
    // Get unique meal types
    const uniqueMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    
    // For each date, group meals by meal type and combine their values
    sortedDates.forEach(date => {
      const dateData = groupedByDate.get(date) || [];
      
      if (dateData.length > 0) {
        const mealsByType = d3.group(dateData, d => d.mealType);
      
        // For each meal type, combine all meals of that type for this date
        mealsByType.forEach((meals, mealType) => {
          // Calculate total calories
          const totalCalories = d3.sum(meals, d => d.calories);
          
          // Calculate weighted efficiency based on calorie contribution
          const weightedEfficiency = meals.reduce((acc, meal) => {
            return acc + (meal.efficiency * meal.calories / totalCalories);
          }, 0);
          
          // Calculate total actual energy and wasted energy
          const totalActualEnergy = d3.sum(meals, d => d.actualEnergy);
          const totalWastedEnergy = totalCalories - totalActualEnergy;
          
          // Create a combined meal entry
          combinedData.push({
            date: date,
            mealType: mealType,
            time: meals[0].time, // Use time from first meal as reference
            name: `${mealType} (${meals.length} items)`,
            efficiency: Math.round(weightedEfficiency),
            calories: totalCalories,
            actualEnergy: totalActualEnergy,
            wastedEnergy: totalWastedEnergy,
            originalMeals: meals // Keep original meals for detailed tooltip
          });
        });
      }
    });
    
    const sortedCombinedData = [...combinedData].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });

    // Calculate x scales for outer (dates) and inner (meal types) bands
    const xOuter = d3.scaleBand()
      .domain(sortedDates)
      .range([0, width])
      .padding(0.2);
    
    const xInner = d3.scaleBand()
      .domain(uniqueMealTypes)
      .range([0, xOuter.bandwidth()])
      .padding(0.1);
    
    // Format date labels - just show MM/DD
    const formatDate = date => {
      const parts = date.split('-');
      return `${parts[1]}/${parts[2]}`;
    };
    
    // y scale for calories
    const maxCalories = d3.max(combinedData, d => d.calories) || 1000;
    const y = d3.scaleLinear()
      .domain([0, maxCalories])
      .range([height, 0]);

    // y scale for efficiency - use fixed range 0-100% for consistency
    const yEff = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0]);

    // Create axes
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xOuter).tickFormat(formatDate))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

    // Add y-axis for calories (left)
    svg.append("g")
      .call(d3.axisLeft(y))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -50)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#000")
      .text("Calories");

    // Add y-axis for efficiency (right)
    svg.append("g")
      .attr("transform", `translate(${width}, 0)`)
      .call(d3.axisRight(yEff))
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 50)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#000")
      .text("Metabolic Efficiency (%)");

    // Define colors for meal types
    const mealColors = {
      "Breakfast": "#FF9F1C",  // Orange
      "Lunch": "#2EC4B6",      // Teal
      "Dinner": "#E71D36",     // Red
      "Snack": "#011627"       // Dark blue
    };

    // Default color for undefined meal types
    const defaultColor = "#999999";

    // Add stacked bars showing actual energy and potential energy
    combinedData.forEach(meal => {
      const mealColor = mealColors[meal.mealType] || defaultColor;
      const barX = xOuter(meal.date) + xInner(meal.mealType);
      const barWidth = xInner.bandwidth();
      
      // 1. First add the "actual energy" bar (colored by meal type)
      svg.append("rect")
        .attr("class", "actual-energy-bar")
        .attr("x", barX)
        .attr("y", y(meal.actualEnergy))
        .attr("width", barWidth)
        .attr("height", height - y(meal.actualEnergy))
        .attr("fill", mealColor)
        .attr("opacity", 0.9)
        .attr("stroke", "#333")
        .attr("stroke-width", 1)
        .on("mouseover", function(event) {
          d3.select(this).attr("opacity", 0.7);
          tooltip
            .style("visibility", "visible")
            .html(`
              <div style="font-weight:bold;margin-bottom:10px;font-size:15px;">${meal.date} - ${meal.mealType}</div>
              <div style="margin-bottom:6px;">Total Calories: ${Math.round(meal.calories)}</div>
              <div style="margin-bottom:6px;"><strong>Usable Energy: ${Math.round(meal.actualEnergy)} cal (${meal.efficiency}% efficient)</strong></div>
              <div style="margin-bottom:12px;">Energy Lost: ${Math.round(meal.wastedEnergy)} cal</div>
              <div style="font-weight:bold;margin-bottom:5px;">Individual Items:</div>
              <ul style="margin-top:0;padding-left:20px;">
                ${meal.originalMeals.map(item => `
                  <li>${item.name} - ${item.calories} cal (${item.efficiency || meal.efficiency}% efficient)</li>
                `).join('')}
              </ul>
            `)
            .style("left", `${event.pageX + 15}px`)
            .style("top", `${event.pageY - 10}px`);
        })
        .on("mouseout", function() {
          d3.select(this).attr("opacity", 0.9);
          tooltip.style("visibility", "hidden");
        });
      
      // 2. Add the "potential energy" bar (semi-transparent)
      svg.append("rect")
        .attr("class", "potential-energy-bar")
        .attr("x", barX)
        .attr("y", y(meal.calories))
        .attr("width", barWidth)
        .attr("height", y(meal.actualEnergy) - y(meal.calories))
        .attr("fill", mealColor)
        .attr("opacity", 0.3)
        .attr("stroke", "#333")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3")
        .on("mouseover", function(event) {
          d3.select(this).attr("opacity", 0.5);
          tooltip
            .style("visibility", "visible")
            .html(`
              <div style="font-weight:bold;margin-bottom:10px;font-size:15px;">${meal.date} - ${meal.mealType}</div>
              <div style="margin-bottom:6px;">Total Calories: ${Math.round(meal.calories)}</div>
              <div style="margin-bottom:6px;">Usable Energy: ${Math.round(meal.actualEnergy)} cal (${meal.efficiency}% efficient)</div>
              <div style="margin-bottom:12px;"><strong>Energy Lost: ${Math.round(meal.wastedEnergy)} cal</strong></div>
            `)
            .style("left", `${event.pageX + 15}px`)
            .style("top", `${event.pageY - 10}px`);
        })
        .on("mouseout", function() {
          d3.select(this).attr("opacity", 0.3);
          tooltip.style("visibility", "hidden");
        });
    });

    // Add efficiency line - only connect points where data exists
    if (sortedCombinedData.length > 0) {
      const lineGenerator = d3.line()
        .x(d => xOuter(d.date) + xInner(d.mealType) + xInner.bandwidth() / 2)
        .y(d => yEff(d.efficiency))
        .defined(d => d.efficiency != null)
        .curve(d3.curveMonotoneX);
      
      svg.append("path")
        .datum(sortedCombinedData)
        .attr("fill", "none")
        .attr("stroke", "#FF5733")
        .attr("stroke-width", 3)
        .attr("d", lineGenerator);
      
      // Add efficiency points
      svg.selectAll(".efficiency-point")
        .data(combinedData)
        .enter()
        .append("circle")
        .attr("class", "efficiency-point")
        .attr("cx", d => xOuter(d.date) + xInner(d.mealType) + xInner.bandwidth() / 2)
        .attr("cy", d => yEff(d.efficiency))
        .attr("r", 5)
        .attr("fill", "#FF5733")
        .attr("stroke", "#333")
        .attr("stroke-width", 1)
        .on("mouseover", function(event, d) {
          d3.select(this).attr("r", 8);
          tooltip
            .style("visibility", "visible")
            .html(`
              <div style="font-weight:bold;font-size:16px;">${d.mealType} on ${d.date}</div>
              <div>Metabolic Efficiency: <strong>${d.efficiency}%</strong></div>
              <div style="margin-top:6px">Your body converts <strong>${d.efficiency}%</strong> of consumed calories into usable energy.</div>
            `)
            .style("left", `${event.pageX + 15}px`)
            .style("top", `${event.pageY - 10}px`);
        })
        .on("mouseout", function() {
          d3.select(this).attr("r", 5);
          tooltip.style("visibility", "hidden");
        });
    }
    
    // Add legend
    const legendY = height + 80;
    
    // Legend for efficiency line
    svg.append("line")
      .attr("x1", 10)
      .attr("x2", 40)
      .attr("y1", legendY)
      .attr("y2", legendY)
      .attr("stroke", "#FF5733")
      .attr("stroke-width", 3);
    
    svg.append("circle")
      .attr("cx", 25)
      .attr("cy", legendY)
      .attr("r", 5)
      .attr("fill", "#FF5733")
      .attr("stroke", "#333")
      .attr("stroke-width", 1);
    
    svg.append("text")
      .attr("x", 50)
      .attr("y", legendY + 4)
      .style("font-size", "12px")
      .text("Efficiency (%)");
    
    // Legend for bars
    const legendData = [
      { label: "Usable Energy", color: "#2EC4B6", opacity: 0.9 },
      { label: "Energy Lost", color: "#2EC4B6", opacity: 0.3 }
    ];
    
    svg.selectAll(".legend-rect")
      .data(legendData)
      .enter()
      .append("rect")
      .attr("x", 200)
      .attr("y", (d, i) => legendY - 10 + i * 20)
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", d => d.color)
      .attr("opacity", d => d.opacity)
      .attr("stroke", "#333")
      .attr("stroke-width", 1);
    
    svg.selectAll(".legend-text")
      .data(legendData)
      .enter()
      .append("text")
      .attr("x", 225)
      .attr("y", (d, i) => legendY + 2 + i * 20)
      .style("font-size", "12px")
      .text(d => d.label);
    
    // Add meal type color legend
    const mealTypeData = Object.entries(mealColors).map(([type, color]) => ({ type, color }));
    
    svg.selectAll(".meal-type-rect")
      .data(mealTypeData)
      .enter()
      .append("rect")
      .attr("x", (d, i) => 400 + Math.floor(i/2) * 120)
      .attr("y", (d, i) => legendY - 10 + (i % 2) * 20)
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", d => d.color)
      .attr("stroke", "#333")
      .attr("stroke-width", 1);
    
    svg.selectAll(".meal-type-text")
      .data(mealTypeData)
      .enter()
      .append("text")
      .attr("x", (d, i) => 425 + Math.floor(i/2) * 120)
      .attr("y", (d, i) => legendY + 2 + (i % 2) * 20)
      .style("font-size", "12px")
      .text(d => d.type);

    // Cleanup function to remove tooltip when component unmounts
    return () => {
      d3.select(".chart-tooltip").remove();
    };
  }, [chartRef, processedData, userData]);
  
  // If no data, show placeholder
  if (!processedData || processedData.length === 0) {
    return (
      <div className="chart-container">
        <div ref={chartRef} className="efficiency-chart">
          <div className="placeholder">
            <p>No meal data available. Please add some meals to see your metabolic efficiency chart.</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="chart-container">
      <div ref={chartRef} className="efficiency-chart" style={{ minHeight: '500px' }}></div>
      <div className="" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
    
        <h4>Understanding Metabolic Efficiency</h4>
        <p>
          Metabolic efficiency refers to how effectively your body converts the calories you consume into usable energy. 
          The chart shows both the energy your body successfully uses (solid bars) and the energy that's lost during 
          digestion and metabolism (transparent sections).
        </p>
        <p>
          <strong>Key insights:</strong>
        </p>
        <ul>
          <li>Higher efficiency percentages mean more of your food energy is being utilized</li>
          <li>The red line tracks your efficiency over time across different meals</li>
          <li>Different meal types and timing can affect how efficiently your body processes food</li>
        </ul>
        </div>
    </div>
  );
}



//

export { AnalysisTab, MacronutrientChart, MicronutrientChart, EfficiencyChart };