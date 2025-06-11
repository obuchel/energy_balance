import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import './MicronutrientChart.css';
import './FoodTrackerAnalysis.css';
// Import enhanced efficiency functions
import { 
  estimateMicronutrientEnhancement, 
  estimateStandardMicronutrientEnhancement,
  calculateFoodEfficiency
} from './enhanced-efficiency-functions';

// Local getSeverityFactor function with correct logic
const getSeverityFactor = (severity) => {
  console.log('getSeverityFactor called with:', severity);
  
  if (!severity || severity === 'None' || severity === null || severity === undefined) {
    console.log('Returning 1.0 for None/null severity');
    return 1.0; // No COVID = normal factor
  }
  
  const severityMap = {
    'mild': 1.1,        // 10% increase in RDA needs
    'moderate': 1.3,    // 30% increase in RDA needs  
    'severe': 1.5,      // 50% increase in RDA needs
    'very severe': 1.7  // 70% increase in RDA needs
  };
  
  const normalizedSeverity = severity.toString().toLowerCase();
  const factor = severityMap[normalizedSeverity] || 1.0;
  
  console.log(`Severity "${severity}" normalized to "${normalizedSeverity}" -> factor: ${factor}`);
  return factor;
};

// Debug version of calculateFoodEfficiency with detailed logging
const calculateFoodEfficiencyDebug = (mealData, userProfile) => {
  console.log('=== DEBUGGING EFFICIENCY CALCULATION ===');
  console.log('Input mealData:', mealData);
  console.log('Input userProfile:', userProfile);
  
  // Step 1: Parse time
  const timeStr = mealData.time;
  console.log('Time string:', timeStr);
  
  const hourMatch = timeStr.match(/(\d+):/);
  const hour = hourMatch ? parseInt(hourMatch[1], 10) : 12;
  const isPM = timeStr.toLowerCase().includes('pm');
  
  console.log('Parsed hour:', hour, 'isPM:', isPM);
  
  let hour24 = hour;
  if (isPM && hour !== 12) hour24 += 12;
  if (!isPM && hour === 12) hour24 = 0;
  
  console.log('24-hour format:', hour24);
  
  // Step 2: Calculate macronutrient factors
  const protein = parseFloat(mealData.protein) || 0;
  const carbs = parseFloat(mealData.carbs) || 0;
  const fat = parseFloat(mealData.fat) || 0;
  
  console.log('Macros - Protein:', protein, 'Carbs:', carbs, 'Fat:', fat);
  
  const proteinFactor = protein * 0.2;
  const carbFactor = carbs * 0.1;
  const fatFactor = fat * 0.15;
  
  console.log('Macro factors - Protein:', proteinFactor, 'Carbs:', carbFactor, 'Fat:', fatFactor);
  
  // Step 3: Calculate time factor
  let timeFactor = 1.0;
  if (hour24 < 6 || hour24 > 20) {
    timeFactor = 0.7;
  } else if (hour24 >= 7 && hour24 <= 10) {
    timeFactor = 1.2;
  } else if (hour24 >= 17 && hour24 <= 19) {
    timeFactor = 0.9;
  }
  
  console.log('Time factor:', timeFactor);
  
  // Step 4: Calculate meal type factor
  const mealTypeFactors = {
    'Breakfast': 1.3,
    'Lunch': 1.1,
    'Dinner': 0.9,
    'Snack': 0.8
  };
  const mealTypeFactor = mealTypeFactors[mealData.mealType] || 1.0;
  
  console.log('Meal type:', mealData.mealType, 'Factor:', mealTypeFactor);
  
  // Step 5: Base efficiency calculation
  const macroBalance = Math.min(100, (proteinFactor + carbFactor + fatFactor) * 10);
  console.log('Macro balance:', macroBalance);
  
  let efficiency = macroBalance * timeFactor * mealTypeFactor;
  console.log('Base efficiency:', efficiency);
  
  // Step 6: Long COVID adjustments
  if (mealData.longCovidAdjust && userProfile?.hasLongCovid) {
    console.log('Applying Long COVID adjustments...');
    
    const severityFactors = {
      'mild': 0.95,
      'moderate': 0.85,
      'severe': 0.75,
      'very severe': 0.65
    };
    
    const severityKey = userProfile.longCovidSeverity?.toLowerCase() || 'moderate';
    const severityFactor = severityFactors[severityKey] || 0.85;
    console.log('Severity factor:', severityFactor);
    
    efficiency *= severityFactor;
    console.log('After severity adjustment:', efficiency);
    
    // Boost for beneficial foods
    if (mealData.longCovidBenefits && mealData.longCovidBenefits.length > 0) {
      efficiency *= 1.1;
      console.log('After benefits boost:', efficiency);
    }
    
    // Reduce for problematic foods
    if (mealData.longCovidCautions && mealData.longCovidCautions.length > 0) {
      efficiency *= 0.9;
      console.log('After cautions reduction:', efficiency);
    }
  }
  
  const finalEfficiency = Math.min(100, Math.max(0, efficiency));
  console.log('Final efficiency:', finalEfficiency);
  console.log('=== END DEBUGGING ===\n');
  
  return finalEfficiency;
};

// Test with sample meal data
const sampleMeal = {
  name: 'Greek Yogurt with Berries',
  protein: 20,
  carbs: 35,
  fat: 8,
  calories: 320,
  mealType: 'Breakfast',
  time: '8:00 AM',
  longCovidAdjust: true,
  longCovidBenefits: ['High protein for recovery', 'Probiotics for gut health']
};

const sampleProfile = {
  hasLongCovid: true,
  longCovidSeverity: 'moderate'
};

// Run the debug test
console.log('Testing with sample data:');
const result = calculateFoodEfficiencyDebug(sampleMeal, sampleProfile);
console.log('Expected result: ~74 (should be > 0)');
console.log('Actual result:', result);

// Common issues to check:
console.log('\n=== COMMON ISSUES TO CHECK ===');
console.log('1. Are protein/carbs/fat values numbers or strings?');
console.log('2. Is mealType exactly matching the case in mealTypeFactors?');
console.log('3. Is time format consistent (e.g., "8:00 AM" vs "8:00 am")?');
console.log('4. Is longCovidSeverity exactly matching the case in severityFactors?');
console.log('5. Are the macro values realistic (not 0 or undefined)?');

function ensureCompleteNutrientData(intakeData, baseRDAData0) {
  const completeData = baseRDAData0;
  
  Object.keys(intakeData).forEach(nutrient => {
    completeData[nutrient] = intakeData[nutrient];
  });
  
  return completeData;
}
function MacronutrientChart({ userData, userIntake = {} }) {
const chartRef = useRef(null);
const [personalizedRDA, setPersonalizedRDA] = useState(null);

const calculatePersonalizedRDA = useCallback((userData) => {
  const calculateBMI = (weight, height) => {
    if (!weight || !height) return null;
    return weight / Math.pow(height / 100, 2);
  };
  
  const calculateTDEE = (userData) => {
    const { age, gender, weight, height, activity_level } = userData;
    
    if (!age || !weight || !height) {
      return 2000;
    }
    
    let bmr;
    if (gender === 'female') {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    } else {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    }
    
    const activityFactors = {
      'sedentary': 1.2,
      'light': 1.375,
      'moderate': 1.55,
      'very': 1.725,
      'extreme': 1.9
    };
    
    const activityMultiplier = activityFactors[activity_level] || 1.375;
    let tdee = bmr * activityMultiplier;
    
    if (userData.covid_condition) {
      tdee *= 1.07;
    }
    
    const bmi = calculateBMI(weight, height);
    if (bmi) {
      if (bmi < 18.5) {
        tdee *= 1.1;
      } else if (bmi > 30) {
        tdee *= 0.9;
      }
    }
    
    return Math.round(tdee);
  };
  
  const calculateMacroDistribution = (totalCalories, userData) => {
    if (!totalCalories) return null;
    
    let proteinPct = 0.25;
    let carbsPct = 0.45;
    let fatPct = 0.3;
    
    if (userData.covid_condition) {
      proteinPct = 0.30;
      carbsPct = 0.40;
      fatPct = 0.30;
    }
    
    const bmi = calculateBMI(userData.weight, userData.height);
    if (bmi && bmi < 18.5) {
      fatPct = 0.35;
      carbsPct = 0.45;
      proteinPct = 0.20;
    }
    
    if (bmi && bmi > 30) {
      proteinPct = 0.35;
      carbsPct = 0.35;
      fatPct = 0.30;
    }
    
    if (userData.age > 65) {
      proteinPct = Math.min(proteinPct + 0.05, 0.40);
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

  const totalCalories = calculateTDEE(userData);
  const macroDistribution = calculateMacroDistribution(totalCalories, userData);
  
  const protein = (totalCalories * macroDistribution.protein / 4).toFixed(1);
  const carbs = (totalCalories * macroDistribution.carbs / 4).toFixed(1);
  const fat = (totalCalories * macroDistribution.fat / 9).toFixed(1);
  
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
}, []);

useEffect(() => {
  if (userData) {
    const rda = calculatePersonalizedRDA(userData);
    setPersonalizedRDA(rda);
  }
}, [userData, calculatePersonalizedRDA]);

useEffect(() => {
  if (!chartRef.current || !personalizedRDA || !userIntake) return;
  
  d3.select(chartRef.current).selectAll("*").remove();
  
  const margin = { top: 40, right: 180, bottom: 60, left: 70 };
  const width = 700 - margin.left - margin.right;
  const height = 350 - margin.top - margin.bottom;
  
  const svg = d3.select(chartRef.current)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
    
  const macros = ['protein', 'carbs', 'fat'];
  const data = [
    { name: "Current Intake", ...userIntake },
    { name: "Recommended", 
      protein: personalizedRDA.protein.value,
      carbs: personalizedRDA.carbs.value,
      fat: personalizedRDA.fat.value
    }
  ];
  
  const colors = {
    protein: "#22c55e",
    carbs: "#3b82f6",
    fat: "#f59e0b"
  };
  
  const x = d3.scaleBand()
    .domain(data.map(d => d.name))
    .range([0, width])
    .padding(0.3);
  
  const maxValue = d3.max(data, d => {
    return d.protein + d.carbs + d.fat;
  });
  
  const y = d3.scaleLinear()
    .domain([0, maxValue * 1.1])
    .range([height, 0]);
  
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("font-size", "12px")
    .attr("font-weight", d => d === "Recommended" ? "bold" : "normal");
  
  svg.append("g")
    .call(d3.axisLeft(y).ticks(5))
    .selectAll("text")
    .attr("font-size", "12px");
  
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 20)
    .attr("x", -height / 2)
    .attr("font-size", "14px")
    .attr("text-anchor", "middle")
    .attr("fill", "#666")
    .text("Grams");
  
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -margin.top / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", "16px")
    .attr("font-weight", "bold")
    .attr("fill", "#333")
    .text(`Long COVID Macronutrient Analysis - ${formattedDate}`);
  
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
  
  const groups = svg.selectAll(".bar-group")
    .data(data)
    .join("g")
    .attr("class", "bar-group")
    .attr("transform", d => `translate(${x(d.name)},0)`);
  
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
      
      const caloriesPerGram = d.nutrient === 'fat' ? 9 : 4;
      const calories = (parentData[d.nutrient] * caloriesPerGram).toFixed(0);
      
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
  
  const calculateCalories = (data) => {
    return (data.protein * 4 + data.carbs * 4 + data.fat * 9).toFixed(0);
  };
  
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
  
  return () => {
    d3.select(".d3-tooltip").remove();
  };
}, [chartRef, personalizedRDA, userIntake, userData]);

return (
  <div className="w-full">
    <div 
      ref={chartRef} 
      className="macro-chart mx-auto overflow-visible"
      style={{ minHeight: "350px" }}
    ></div>
  </div>
);
}

function EfficiencyChart({ data, userData, foodDatabase }) {
const chartRef = useRef(null);
const [processedData, setProcessedData] = useState([]);

useEffect(() => {
  if (!data || data.length === 0) return;
  
  const today = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(today.getDate() - 7);
  
  const lastWeekData = data.filter(meal => {
    try {
      const mealDate = new Date(meal.date);
      return mealDate >= oneWeekAgo;
    } catch (err) {
      console.warn('Error parsing date:', meal.date);
      return false;
    }
  });
  
  const updatedData = lastWeekData.map((meal, index) => {
    try {
      // FIX: Use the existing efficiency if it exists and is valid
      let efficiency = meal.efficiency || meal.metabolicEfficiency;
      
      // Only recalculate if efficiency is missing or invalid
      if (!efficiency || efficiency <= 0) {
        console.log(`Recalculating efficiency for ${meal.name} (was ${efficiency})`);
        efficiency = calculateFoodEfficiency(meal, userData);
      } else {
        console.log(`Using existing efficiency for ${meal.name}: ${efficiency}`);
      }
      
      return {
        ...meal,
        originalEfficiency: meal.efficiency || 80,
        efficiency: efficiency,  // Use existing or calculated
        actualEnergy: Math.round(meal.calories * (efficiency / 100)),
        wastedEnergy: Math.round(meal.calories * ((100 - efficiency) / 100))
      };
    } catch (err) {
      console.warn(`Error processing meal ${index}:`, err);
      const fallbackEfficiency = meal.efficiency || meal.metabolicEfficiency || 80;
      return {
        ...meal,
        efficiency: fallbackEfficiency,
        actualEnergy: Math.round(meal.calories * (fallbackEfficiency / 100)),
        wastedEnergy: Math.round(meal.calories * ((100 - fallbackEfficiency) / 100))
      };
    }
  });
  
  const filteredData = updatedData.filter(meal => 
    meal.mealType !== "Pre-workout" && meal.mealType !== "Post-workout"
  );
  
  console.log('ProcessedData with preserved efficiency:', filteredData);
  setProcessedData(filteredData);
}, [data, userData, foodDatabase]);


useEffect(() => {
  if (!chartRef.current || !processedData || processedData.length === 0) return;
  
  d3.select(chartRef.current).selectAll("*").remove();
  
  const margin = { top: 60, right: 120, bottom: 140, left: 70 };
  const width = 800 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;
  
  const svg = d3.select(chartRef.current)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -30)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .text("Metabolic Efficiency Chart");
    
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .style("font-style", "italic")
    .text("How efficiently your body converts food into usable energy");
  
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
  
  const allDatesInRange = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    const formattedDate = date.toISOString().split('T')[0];
    allDatesInRange.push(formattedDate);
  }
  
  console.log('=== CHART DEBUG ===');
  console.log('processedData:', processedData);
  
  const combinedData = [];
  const groupedByDate = d3.group(processedData, d => d.date);
  const sortedDates = allDatesInRange;
  const uniqueMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  
  sortedDates.forEach(date => {
    const dateData = groupedByDate.get(date) || [];
    
    if (dateData.length > 0) {
      const mealsByType = d3.group(dateData, d => d.mealType);
    
      mealsByType.forEach((meals, mealType) => {
        const totalCalories = d3.sum(meals, d => d.calories);
        
        // FIX: Make sure we're using the efficiency from the data
        const weightedEfficiency = meals.reduce((acc, meal) => {
          const mealEfficiency = meal.efficiency || 0; // Use existing efficiency
          const calorieWeight = totalCalories > 0 ? meal.calories / totalCalories : 0;
          console.log(`Meal: ${meal.name}, efficiency: ${mealEfficiency}, calories: ${meal.calories}, weight: ${calorieWeight}`);
          return acc + (mealEfficiency * calorieWeight);
        }, 0);
        
        console.log(`Combined efficiency for ${mealType} on ${date}: ${weightedEfficiency}`);
        
        const totalActualEnergy = d3.sum(meals, d => d.actualEnergy || (d.calories * (d.efficiency / 100)));
        const totalWastedEnergy = totalCalories - totalActualEnergy;
        
        combinedData.push({
          date: date,
          mealType: mealType,
          time: meals[0].time,
          name: `${mealType} (${meals.length} items)`,
          efficiency: Math.round(weightedEfficiency), // This should NOT be 0
          calories: totalCalories,
          actualEnergy: totalActualEnergy,
          wastedEnergy: totalWastedEnergy,
          originalMeals: meals
        });
      });
    }
  });
  
  console.log('Final combinedData:', combinedData);
  console.log('=== END CHART DEBUG ===');
  
  const sortedCombinedData = [...combinedData].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  const xOuter = d3.scaleBand()
    .domain(sortedDates)
    .range([0, width])
    .padding(0.2);
  
  const xInner = d3.scaleBand()
    .domain(uniqueMealTypes)
    .range([0, xOuter.bandwidth()])
    .padding(0.1);
  
  const formatDate = date => {
    const parts = date.split('-');
    return `${parts[1]}/${parts[2]}`;
  };
  
  const maxCalories = d3.max(combinedData, d => d.calories) || 1000;
  const y = d3.scaleLinear()
    .domain([0, maxCalories])
    .range([height, 0]);

  const yEff = d3.scaleLinear()
    .domain([0, 100])
    .range([height, 0]);

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(xOuter).tickFormat(formatDate))
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-45)");

  svg.append("g")
    .call(d3.axisLeft(y))
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -50)
    .attr("x", -height / 2)
    .attr("text-anchor", "middle")
    .style("fill", "#000")
    .text("Calories");

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

  const mealColors = {
    "Breakfast": "#FF9F1C",
    "Lunch": "#2EC4B6",
    "Dinner": "#E71D36",
    "Snack": "#011627"
  };

  const defaultColor = "#999999";

  combinedData.forEach(meal => {
    const mealColor = mealColors[meal.mealType] || defaultColor;
    const barX = xOuter(meal.date) + xInner(meal.mealType);
    const barWidth = xInner.bandwidth();
    
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
  
  const legendY = height + 80;
  
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

  return () => {
    d3.select(".chart-tooltip").remove();
  };
}, [chartRef, processedData, userData]);

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
    <div className="chart-info">
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

export { AnalysisTab, MacronutrientChart, MicronutrientChart, EfficiencyChart };

const debugMealData = (mealData) => {
console.log("=== MEAL DATA DEBUGGER ===");

const sortedData = [...mealData].sort((a, b) => {
  return a.time.localeCompare(b.time);
});

sortedData.forEach(meal => {
  console.log(
    `Time: "${meal.time}" | ` +
    `MealType: "${meal.mealType}" | ` + 
    `Date: "${meal.date}"`
  );
});

console.log("=== END MEAL DATA ===");
return mealData;
};

const convertTo24Hour = (time12h) => {
  if (!time12h) return '';

  const [time, modifier] = time12h.split(' ');
  if (!time || !modifier) return time12h; // Return original if format is unexpected
  
  let [hours, minutes] = time.split(':');
  
  // Convert to number for easier manipulation
  let hour24 = parseInt(hours, 10);
  
  if (modifier.toUpperCase() === 'AM') {
    // AM: 12:xx AM becomes 00:xx, everything else stays the same
    if (hour24 === 12) {
      hour24 = 0;
    }
  } else if (modifier.toUpperCase() === 'PM') {
    // PM: 12:xx PM stays 12:xx, everything else adds 12
    if (hour24 !== 12) {
      hour24 += 12;
    }
  }
  
  // Ensure two-digit format
  const formattedHour = hour24.toString().padStart(2, '0');
  
  return `${formattedHour}:${minutes}`;
};

// Test cases to verify the fix
console.log('Testing convertTo24Hour function:');
console.log('12:30 AM ->', convertTo24Hour('12:30 AM')); // Should be 00:30
console.log('1:30 AM  ->', convertTo24Hour('1:30 AM'));  // Should be 01:30
console.log('11:59 AM ->', convertTo24Hour('11:59 AM')); // Should be 11:59
console.log('12:00 PM ->', convertTo24Hour('12:00 PM')); // Should be 12:00
console.log('1:30 PM  ->', convertTo24Hour('1:30 PM'));  // Should be 13:30
console.log('11:59 PM ->', convertTo24Hour('11:59 PM')); // Should be 23:59

const prepareChartData = (rawMealData) => {
  console.log('prepareChartData called with:', rawMealData);

  if (!rawMealData || !Array.isArray(rawMealData)) {
    console.warn('prepareChartData: Invalid input data');
    return [];
  }

  try {
    const formattedData = rawMealData.map((meal, index) => {
      try {
        let timeFormatted = meal.time || '12:00 PM';
        
        // If time is already in 24-hour format, convert it back to 12-hour for consistency
        if (timeFormatted.match(/^\d{1,2}:\d{2}$/) && !timeFormatted.includes('AM') && !timeFormatted.includes('PM')) {
          // Convert 24-hour to 12-hour format
          const [hours, minutes] = timeFormatted.split(':');
          const hour24 = parseInt(hours, 10);
          const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
          const ampm = hour24 < 12 ? 'AM' : 'PM';
          timeFormatted = `${hour12}:${minutes} ${ampm}`;
          console.log(`Converted time from ${meal.time} to ${timeFormatted}`);
        }
        
        return {
          ...meal,
          time: timeFormatted // Keep consistent format
        };
      } catch (err) {
        console.warn(`Error processing meal ${index} in prepareChartData:`, err);
        return {
          ...meal,
          time: '12:00 PM'
        };
      }
    });
    
    debugMealData(formattedData);
    console.log('prepareChartData completed successfully:', formattedData.length, 'items');
    return formattedData;
  } catch (err) {
    console.error('Error in prepareChartData:', err);
    return rawMealData || [];
  }
};

const BulletChart = ({ data, maxPercent }) => {
const actualWidth = Math.min(100, (data.value / data.rda) * 100);
const optimalWidth = Math.min(100, 100);

const getColor = (percent) => {
  if (percent >= 100) return "#4CAF50";
  if (percent >= 70) return "#8BC34A";
  if (percent >= 50) return "#FFC107";
  if (percent >= 30) return "#FF9800";
  return "#F44336";
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
    
    <div className="bullet-chart-track">
      <div 
        className="threshold-marker"
        style={{ left: '70%' }}
      ></div>
      
      <div 
        className="actual-value-bar"
        style={{ 
          width: `${actualWidth}%`, 
          backgroundColor: barColor 
        }}
      ></div>
      
      <div 
        className="target-line"
        style={{ left: `${optimalWidth}%` }}
      ></div>
    </div>
  </div>
);
};

const baseRDAData10 = {
  vitamin_a: {
    value: 900,
    unit: 'mcg',
    femaleAdjust: 0.78,
    description: "Supports vision, immune function, and cell growth"
  },
  vitamin_c: {
    value: 90,
    unit: 'mg',
    femaleAdjust: 0.83,
    description: "Antioxidant that supports immune function and collagen production"
  },
  vitamin_d: {
    value: 15, // Changed from 600 UI to 15 mcg
    unit: 'mcg',
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
    femaleAdjust: 2.25,
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
    femaleAdjust: 0.76,
    description: "Involved in over 300 biochemical reactions in the body"
  },
  zinc: {
    value: 11,
    unit: 'mg',
    femaleAdjust: 0.73,
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
    femaleAdjust: 0.92,
    description: "Essential for energy metabolism"
  },
  vitamin_b2: {
    value: 1.3,
    unit: 'mg',
    femaleAdjust: 0.85,
    description: "Important for energy production and cell function"
  },
  vitamin_b3: {
    value: 16,
    unit: 'mg',
    femaleAdjust: 0.875, // 14mg / 16mg = 0.875 for correct female adjustment
    description: "Helps convert food into energy"
  }
};

function MicronutrientChart({ data, userData }) {
  // ✅ TEMPORARY: Add some test micronutrient data
  const testData = {
    vitamin_a: { value: 450, unit: 'mcg' },
    vitamin_c: { value: 45, unit: 'mg' },
    vitamin_d: { value: 8, unit: 'mcg' },
    vitamin_e: { value: 7, unit: 'mg' },
    vitamin_b6: { value: 0.8, unit: 'mg' },
    vitamin_b12: { value: 1.5, unit: 'mcg' },
    folate: { value: 200, unit: 'mcg' },
    iron: { value: 12, unit: 'mg' },
    calcium: { value: 800, unit: 'mg' },
    magnesium: { value: 200, unit: 'mg' },
    zinc: { value: 6, unit: 'mg' },
    selenium: { value: 35, unit: 'mcg' },
    copper: { value: 0.5, unit: 'mg' },
    vitamin_b1: { value: 0.9, unit: 'mg' },
    vitamin_b2: { value: 1.0, unit: 'mg' },
    vitamin_b3: { value: 12, unit: 'mg' }
  };
  
  console.log('Using test data:', testData);
  
const [userInfo, setUserInfo] = useState(userData);
const [chartData, setChartData] = useState([]);
const [nutrientIntake] = useState(ensureCompleteNutrientData(testData, baseRDAData10));
const [personalizedRDA, setPersonalizedRDA] = useState({});
const [displayMode, setDisplayMode] = useState('all');
const [isLoading, setIsLoading] = useState(true);
const [selectedCategory, setSelectedCategory] = useState('all');

const calculatePersonalizedRDA = useCallback((baseRDAData_, userData) => {
  console.log('=== DEBUGGING calculatePersonalizedRDA ===');
  console.log('Input baseRDAData_:', baseRDAData_);
  console.log('Input userData:', userData);
  
  if (!baseRDAData_ || Object.keys(baseRDAData_).length === 0) {
    console.error('❌ baseRDAData_ is empty or invalid!');
    return {};
  }
  
  const personalRDA = JSON.parse(JSON.stringify(baseRDAData_));
  
  Object.keys(personalRDA).forEach(nutrient => {
    console.log(`\n--- Processing ${nutrient} ---`);
    console.log(`Initial data:`, personalRDA[nutrient]);
    
    if (!personalRDA[nutrient] || typeof personalRDA[nutrient].value !== 'number') {
      console.error(`❌ Invalid data structure for ${nutrient}:`, personalRDA[nutrient]);
      return;
    }
    
    let adjustedValue = personalRDA[nutrient].value;
    console.log(`Starting value: ${adjustedValue}`);
    
    // Apply gender adjustment
    if (userData.gender && userData.gender.toLowerCase() === 'female') {
      const femaleAdjust = personalRDA[nutrient].femaleAdjust || 1.0;
      adjustedValue *= femaleAdjust;
      console.log(`After female adjust (${femaleAdjust}): ${adjustedValue}`);
    } else {
      console.log(`No female adjustment applied (gender: ${userData.gender})`);
    }
    
    // Apply age adjustments
    if (userData.age) {
      let ageMultiplier = 1.0;
      if (userData.age >= 70) {
        if (nutrient === 'vitamin_d') ageMultiplier = 1.2;
        if (nutrient === 'vitamin_b12') ageMultiplier = 1.1;
        if (nutrient === 'calcium') ageMultiplier = 1.15;
      } else if (userData.age >= 50) {
        if (nutrient === 'vitamin_d') ageMultiplier = 1.1;
        if (nutrient === 'vitamin_b12') ageMultiplier = 1.05;
      } else if (userData.age <= 18) {
        if (nutrient === 'calcium') ageMultiplier = 1.15;
        if (nutrient === 'iron') ageMultiplier = 1.1;
      }
      
      if (ageMultiplier !== 1.0) {
        adjustedValue *= ageMultiplier;
        console.log(`After age adjust (${ageMultiplier}): ${adjustedValue}`);
      } else {
        console.log(`No age adjustment applied for ${nutrient} at age ${userData.age}`);
      }
    }
    
    // Apply COVID severity adjustments
    const severity = userData.covid_severity || userData.longCovidSeverity;
    const hasCovidCondition = severity && severity !== 'None' && severity !== null && severity !== undefined;
    
    console.log(`COVID check - severity: "${severity}", hasCovidCondition: ${hasCovidCondition}`);
    
    if (hasCovidCondition) {
      console.log(`Applying COVID adjustments for severity: "${severity}"`);
      
      const severityFactor = getSeverityFactor(severity);
      console.log(`Severity factor: ${severityFactor}`);
      
      if (['vitamin_c', 'vitamin_d', 'zinc', 'selenium'].includes(nutrient)) {
        const covidMultiplier = Math.min(severityFactor * 1.5, 2.5); // Cap at 2.5x
        adjustedValue *= covidMultiplier;
        console.log(`After COVID high-priority adjust (${covidMultiplier}): ${adjustedValue}`);
      } else if (['vitamin_a', 'vitamin_e', 'vitamin_b6', 'vitamin_b12', 'folate', 'iron'].includes(nutrient)) {
        const covidMultiplier = Math.min(severityFactor * 1.3, 2.0); // Cap at 2x
        adjustedValue *= covidMultiplier;
        console.log(`After COVID medium-priority adjust (${covidMultiplier}): ${adjustedValue}`);
      } else if (['magnesium', 'copper', 'vitamin_b1', 'vitamin_b2', 'vitamin_b3'].includes(nutrient)) {
        const covidMultiplier = Math.min(severityFactor * 1.1, 1.5); // Cap at 1.5x
        adjustedValue *= covidMultiplier;
        console.log(`After COVID low-priority adjust (${covidMultiplier}): ${adjustedValue}`);
      }
    } else {
      console.log('No COVID adjustments applied - using baseline RDA');
    }
    
    // Final safety check
    if (isNaN(adjustedValue) || !isFinite(adjustedValue) || adjustedValue <= 0) {
      console.error(`❌ Invalid final value for ${nutrient}: ${adjustedValue}, resetting to base`);
      adjustedValue = personalRDA[nutrient].value;
    }
    
    const roundedValue = Math.round(adjustedValue * 10) / 10;
    console.log(`Final rounded value: ${roundedValue}`);
    
    personalRDA[nutrient] = {
      ...personalRDA[nutrient],
      value: roundedValue,
      isAdjusted: roundedValue !== baseRDAData_[nutrient].value
    };
  });
  
  console.log('Final personalRDA:', personalRDA);
  console.log('=== END calculatePersonalizedRDA DEBUG ===\n');
  
  return personalRDA;
}, []);

const processNutrientData = useCallback((intake, rdaValues) => {
  console.log('=== DEBUGGING processNutrientData ===');
  console.log('Input intake:', intake);
  console.log('Input rdaValues:', rdaValues);
  
  if (!rdaValues || Object.keys(rdaValues).length === 0) {
    console.error('No RDA values provided to processNutrientData');
    return;
  }
  
  let enhancedIntake = intake;
  if (userData.covid_severity || userData.longCovidSeverity) {
    const severity = userData.covid_severity || userData.longCovidSeverity;
    enhancedIntake = estimateMicronutrientEnhancement(intake, severity);
  } else {
    enhancedIntake = estimateStandardMicronutrientEnhancement(intake, userData);
  }
  
  let processedData = Object.entries(enhancedIntake).map(([key, details]) => {
    console.log(`Processing ${key}:`, details, 'RDA:', rdaValues[key]);
    
    if (!rdaValues[key]) {
      console.warn(`No RDA data for ${key}`);
      return null;
    }
    
    const intakeValue = typeof details === 'object' ? (details.value || details.recommendedValue || 0) : (details || 0);
    const rdaValue = rdaValues[key].value;
    
    // ✅ Add safety checks
    if (isNaN(intakeValue) || isNaN(rdaValue) || rdaValue === 0) {
      console.warn(`Invalid values for ${key}: intake=${intakeValue}, rda=${rdaValue}`);
      return null;
    }
    
    const unit = rdaValues[key].unit || 'mg';
    const percentOfRDA = (intakeValue / rdaValue) * 100;
    const formattedName = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const isAdjusted = rdaValues[key].isAdjusted || (details.isEnhanced && details.isEnhanced);
    const standardRDA = baseRDAData10[key]?.value || rdaValue;
    const category = key.includes('vitamin') ? 'vitamins' : 'minerals';
    
    const result = {
      name: formattedName,
      key: key,
      percentOfRDA: Math.min(percentOfRDA, 150),
      fullPercent: percentOfRDA,
      value: intakeValue,
      unit: unit,
      rda: rdaValue,
      standardRDA: standardRDA,
      isAdjusted: isAdjusted,
      description: rdaValues[key].description || '',
      category: category,
      enhancementReason: details.reason || null
    };
    
    console.log(`${key} result:`, result);
    return result;
  }).filter(item => item !== null);
  
  // Apply display filters
  if (displayMode === 'deficient') {
    processedData = processedData.filter(item => item.percentOfRDA < 90);
  } else if (displayMode === 'optimal') {
    processedData = processedData.filter(item => item.percentOfRDA >= 90);
  }
  
  if (selectedCategory !== 'all') {
    processedData = processedData.filter(item => item.category === selectedCategory);
  }
  
  processedData.sort((a, b) => a.percentOfRDA - b.percentOfRDA);
  
  console.log('Final processedData:', processedData);
  console.log('=== END processNutrientData DEBUG ===');
  
  setChartData(processedData);
}, [displayMode, selectedCategory, userData]);

// 4. Add this debug function to check your userData structure
const debugUserData = (userData) => {
  console.log('=== USER DATA STRUCTURE ===');
  console.log('userData:', userData);
  console.log('covid_severity:', userData.covid_severity, typeof userData.covid_severity);
  console.log('longCovidSeverity:', userData.longCovidSeverity);
  console.log('hasLongCovid:', userData.hasLongCovid);
  console.log('age:', userData.age);
  console.log('gender:', userData.gender);
  console.log('weight:', userData.weight);
  console.log('height:', userData.height);
  console.log('=== END USER DATA ===');
};

useEffect(() => {
  debugUserData(userInfo); // Add this debug call
  
  setTimeout(() => {
    try {
      const calculatedRDA = calculatePersonalizedRDA(baseRDAData10, userInfo);
      
      if (!calculatedRDA || Object.keys(calculatedRDA).length === 0) {
        console.error('Failed to calculate RDA values');
        return;
      }
      
      setPersonalizedRDA(calculatedRDA);
      processNutrientData(nutrientIntake, calculatedRDA);
      setIsLoading(false);
    } catch (error) {
      console.error('Error in useEffect:', error);
      setIsLoading(false);
    }
  }, 500);
}, [userInfo, calculatePersonalizedRDA, processNutrientData, nutrientIntake]);

const getCovidSeverityClass = (severity) => {
  switch(severity) {
    case 'Mild': return 'covid-severity-mild';
    case 'Moderate': return 'covid-severity-moderate';
    case 'Severe': return 'covid-severity-severe';
    case 'Very Severe': return 'covid-severity-very-severe';
    default: return 'covid-severity-unknown';
  }
};

const toggleCovidSeverity = () => {
  const severities = [null, 'mild', 'moderate', 'severe', 'very severe'];
  
  // Check both possible property names for current severity
  const currentSeverity = userInfo.covid_severity || userInfo.longCovidSeverity || null;
  const currentIndex = severities.indexOf(currentSeverity);
  const nextIndex = (currentIndex + 1) % severities.length;
  
  const newSeverity = severities[nextIndex];
  console.log(`Toggling COVID severity from "${currentSeverity}" to "${newSeverity}"`);
  
  const updatedUserInfo = {
    ...userInfo,
    // Update BOTH properties to ensure consistency
    covid_severity: newSeverity,
    longCovidSeverity: newSeverity,
    hasLongCovid: newSeverity !== null // Set hasLongCovid based on severity
  };
  
  // Remove covid properties entirely if severity is null
  if (newSeverity === null) {
    delete updatedUserInfo.covid_severity;
    delete updatedUserInfo.longCovidSeverity;
    updatedUserInfo.hasLongCovid = false;
  }
  
  console.log('Updated user info:', updatedUserInfo);
  setUserInfo(updatedUserInfo);
};
const getCurrentCovidSeverity = () => {
  const severity = userInfo.covid_severity || userInfo.longCovidSeverity;
  if (!severity || severity === null) return 'None';
  
  // Capitalize first letter for display
  return severity.charAt(0).toUpperCase() + severity.slice(1);
};
const changeDisplayMode = (mode) => {
  setDisplayMode(mode);
  processNutrientData(nutrientIntake, personalizedRDA);
};

const changeCategory = (category) => {
  setSelectedCategory(category);
  processNutrientData(nutrientIntake, personalizedRDA);
};

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
  style={{
    padding: '8px 12px',
    backgroundColor: '#e3f2fd',
    border: '2px solid #2196f3',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#1976d2',
    transition: 'all 0.2s ease',
    minWidth: '120px'
  }}
  onMouseEnter={(e) => {
    e.target.style.backgroundColor = '#bbdefb';
    e.target.style.transform = 'scale(1.02)';
  }}
  onMouseLeave={(e) => {
    e.target.style.backgroundColor = '#e3f2fd';
    e.target.style.transform = 'scale(1)';
  }}
>
  {getCurrentCovidSeverity()} (Click to change)
</button>
            
        </div>
      </div>
    </div>
  </div>
);
}

function AnalysisTab({ foodLog, userProfile }) {
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

const getChartData = () => {
  if (foodLog.length === 0) return { macroSums: {}, microSums: {}, efficiencyData: [] };

  const lastDate = foodLog[0].date;
  const lastDayEntries = foodLog.filter(e => e.date === lastDate);
  
  console.log('=== DEBUGGING getChartData ===');
  console.log('lastDayEntries:', lastDayEntries);
  
  // Calculate macro sums
  const macroSums = lastDayEntries.reduce((acc, e) => {
    acc.protein = (acc.protein || 0) + (parseFloat(e.protein) || 0);
    acc.carbs = (acc.carbs || 0) + (parseFloat(e.carbs) || 0);
    acc.fat = (acc.fat || 0) + (parseFloat(e.fat) || 0);
    acc.calories = (acc.calories || 0) + (parseFloat(e.calories) || 0);
    return acc;
  }, {});
  
  // Debug each entry's micronutrients
  lastDayEntries.forEach((entry, index) => {
    console.log(`\nEntry ${index}: ${entry.name}`);
    console.log(`micronutrients:`, entry.micronutrients);
    
    if (entry.micronutrients) {
      Object.entries(entry.micronutrients).forEach(([key, value]) => {
        console.log(`  ${key}:`, value);
      });
    } else {
      console.warn(`❌ No micronutrients data for ${entry.name}`);
    }
  });

  const microSums = lastDayEntries.reduce((acc, e) => {
    if (e.micronutrients) {
      Object.entries(e.micronutrients).forEach(([k, v]) => {
        if (!['protein','carbs','fat','calories','name','unit'].includes(k)) {
          const value = typeof v === 'object' ? (v.value || 0) : v;
          const numValue = parseFloat(value) || 0;
          acc[k] = (acc[k] || 0) + numValue;
          console.log(`Adding ${k}: ${numValue}, running total: ${acc[k]}`);
        }
      });
    }
    return acc;
  }, {});

  console.log('Final macroSums:', macroSums);
  console.log('Final microSums:', microSums);
  console.log('=== END getChartData DEBUG ===\n');
  
  // Prepare efficiency data (use the entire food log for trend analysis)
  const efficiencyData = foodLog;
  
  return { macroSums, microSums, efficiencyData };
};

const today = new Date().toISOString().slice(0, 10);
const analysisDate = foodLog.length > 0 ? foodLog[0].date : today;
const todayMeals = foodLog.filter(entry => entry.date === today);
const { macroSums, microSums, efficiencyData } = getChartData();

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
      
      <div className="chart-wrapper">
        <div className="chart-header">
          <h4>🍎 Macronutrient Balance</h4>
          <p className="chart-description">Your protein, carbohydrate, and fat intake compared to personalized recommendations</p>
        </div>
        <MacronutrientChart userData={userProfile} userIntake={macroSums} />
      </div>
      
      <div className="chart-wrapper">
        <div className="chart-header">
          <h4>💊 Micronutrient Status</h4>
          <p className="chart-description">Essential vitamins and minerals as percentage of recommended daily amounts</p>
        </div>
        <MicronutrientChart data={microSums} userData={userProfile} />
      </div>
      
      <div className="chart-wrapper one">
        <div className="chart-header">
          <h4>⚡ Metabolic Efficiency</h4>
          <p className="chart-description">How effectively your body converts food calories into usable energy</p>
        </div>
        <EfficiencyChart data={prepareChartData(efficiencyData)} userData={userProfile} />
      </div>

    </div>
  </div>
);
}