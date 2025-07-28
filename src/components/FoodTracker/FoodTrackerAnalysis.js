import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import './MicronutrientChart.css';
import './FoodTrackerAnalysis.css';
// Import enhanced efficiency functions
import { 
  calculateFoodEfficiency
} from './enhanced-efficiency-functions';

// FIXED: Utility functions to handle dates without timezone issues
const parseDate = (dateString) => {
  const parts = dateString.split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};

const formatDateForComparison = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isSameOrAfter = (dateString1, dateString2) => {
  const date1 = parseDate(dateString1);
  const date2 = parseDate(dateString2);
  return date1 >= date2;
};

// FIXED: Enhanced ensureCompleteNutrientData function with better unit handling
function ensureCompleteNutrientData(intakeData, baseRDAData) {
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
  // ADD THIS: IU to mcg conversion for vitamin A
  else if (finalUnit === 'IU' && nutrientKey === 'vitamin_a' && rdaInfo.unit === 'mcg') {
    finalValue = finalValue * 0.3; // 1 IU ≈ 0.3 mcg RAE for vitamin A
    finalUnit = 'mcg';
  }
  // ADD THIS: IU to mcg conversion for vitamin D  
  else if (finalUnit === 'IU' && nutrientKey === 'vitamin_d' && rdaInfo.unit === 'mcg') {
    finalValue = finalValue * 0.025; // 1 IU = 0.025 mcg for vitamin D
    finalUnit = 'mcg';
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

// Updated EfficiencyChart in FoodTrackerAnalysis.js
function EfficiencyChart({ data, userData, foodDatabase }) {
  const chartRef = useRef(null);
  const [processedData, setProcessedData] = useState([]);

  useEffect(() => {
    if (!data || data.length === 0) return;
    
    // FIXED: Use proper date comparison without timezone issues
    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);
    const oneWeekAgoString = formatDateForComparison(oneWeekAgo);
    
    const lastWeekData = data.filter(meal => {
      try {
        return isSameOrAfter(meal.date, oneWeekAgoString);
      } catch (err) {
        console.warn('Error parsing date:', meal.date);
        return false;
      }
    });
    
    const updatedData = lastWeekData.map((meal, index) => {
      try {
        // ALWAYS recalculate efficiency using the enhanced function for consistency
        console.log(`Calculating efficiency for ${meal.name} using enhanced function`);
        const efficiency = calculateFoodEfficiency(meal, userData);
        
        // Fallback to stored efficiency if calculation fails
        const finalEfficiency = (efficiency && efficiency > 0) ? efficiency : (meal.efficiency || meal.metabolicEfficiency || 80);
        
        console.log(`Final efficiency for ${meal.name}: ${finalEfficiency}`);
        
        return {
          ...meal,
          originalEfficiency: meal.efficiency || meal.metabolicEfficiency || 80,
          efficiency: finalEfficiency,
          actualEnergy: Math.round(meal.calories * (finalEfficiency / 100)),
          wastedEnergy: Math.round(meal.calories * ((100 - finalEfficiency) / 100))
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
    
    console.log('ProcessedData with consistent efficiency:', filteredData);
    setProcessedData(filteredData);
  }, [data, userData, foodDatabase]);

  useEffect(() => {
    if (!chartRef.current || !processedData || processedData.length === 0) return;
    
    d3.select(chartRef.current).selectAll("*").remove();
    
    const margin = { top: 60, right: 20, bottom: 50, left: 50 };
    const width = 900 - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom;
    
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
      .text("Enhanced Metabolic Efficiency Chart");
      
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-style", "italic")
      .text("Optimized for Long COVID energy management");
    
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
    
    // Generate date range without timezone issues
    const allDatesInRange = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const formattedDate = formatDateForComparison(date);
      allDatesInRange.push(formattedDate);
    }
    
    console.log('=== ENHANCED CHART DEBUG ===');
    console.log('processedData:', processedData);
    
    const combinedData = [];
    const groupedByDate = d3.group(processedData, d => d.date);
    
    // Process meal types in the correct order
    const uniqueMealTypes = ['Breakfast', 'Morning Snack', 'Lunch', 'Afternoon Snack', 'Dinner', 'Late Night Snack'];
    
    allDatesInRange.forEach(date => {
      const dateData = groupedByDate.get(date) || [];
      
      if (dateData.length > 0) {
        const mealsByType = d3.group(dateData, d => d.mealType);
      
        // Process meal types in the defined order
        uniqueMealTypes.forEach(mealType => {
          const meals = mealsByType.get(mealType);
          if (meals && meals.length > 0) {
            const totalCalories = d3.sum(meals, d => d.calories);
            
            // Calculate weighted efficiency using the enhanced efficiency values
            const weightedEfficiency = meals.reduce((acc, meal) => {
              const mealEfficiency = meal.efficiency || 0;
              const calorieWeight = totalCalories > 0 ? meal.calories / totalCalories : 0;
              console.log(`Enhanced: ${meal.name}, efficiency: ${mealEfficiency}, calories: ${meal.calories}, weight: ${calorieWeight}`);
              return acc + (mealEfficiency * calorieWeight);
            }, 0);
            
            console.log(`Enhanced combined efficiency for ${mealType} on ${date}: ${weightedEfficiency}`);
            
            const totalActualEnergy = d3.sum(meals, d => d.actualEnergy || (d.calories * (d.efficiency / 100)));
            const totalWastedEnergy = totalCalories - totalActualEnergy;
            
            combinedData.push({
              date: date,
              mealType: mealType,
              time: meals[0].time,
              name: `${mealType} (${meals.length} items)`,
              efficiency: Math.round(weightedEfficiency),
              calories: totalCalories,
              actualEnergy: totalActualEnergy,
              wastedEnergy: totalWastedEnergy,
              originalMeals: meals,
              mealOrder: uniqueMealTypes.indexOf(mealType) // Add explicit order
            });
          }
        });
      }
    });
    
    console.log('Enhanced Final combinedData:', combinedData);
    console.log('=== END ENHANCED CHART DEBUG ===');
    
    // Sort chronologically: first by date, then by meal order
    const chronologicalData = [...combinedData].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.mealOrder - b.mealOrder;
    });

    const xOuter = d3.scaleBand()
      .domain(allDatesInRange)
      .range([0, width])
      .padding(0.2);
    
    const xInner = d3.scaleBand()
      .domain(uniqueMealTypes)
      .range([0, xOuter.bandwidth()])
      .padding(0.1);
    
    const formatDate = date => {
      const parts = date.split('-');
      return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    };
    
    const maxCalories = d3.max(combinedData, d => d.calories) || 1000;
    const y = d3.scaleLinear()
      .domain([0, maxCalories])
      .range([height, 0]);

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
      .text("Enhanced Efficiency (%)");

    // Color scheme for meal types
    const mealColors = {
   "Breakfast": "#DC2626",        // Red - easily distinguishable
  "Morning Snack": "#EA580C",    // Red-Orange - clear variation
  "Lunch": "#16A34A",            // Green - strong contrast from red
  "Afternoon Snack": "#0891B2",  // Blue - distinct from green
  "Dinner": "#7C3AED",           // Purple - clear from blue
  "Late Night Snack": "#BE185D"  // Pink - distinct endpoint
    
    };

    // Add stacked bars
    combinedData.forEach(meal => {
      const mealColor = mealColors[meal.mealType] || "#999999";
      const barX = xOuter(meal.date) + xInner(meal.mealType);
      const barWidth = xInner.bandwidth();
      
      // Actual energy bar
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
              <div style="margin-bottom:6px;"><strong>Enhanced Efficiency: ${meal.efficiency}%</strong></div>
              <div style="margin-bottom:6px;">Usable Energy: ${Math.round(meal.actualEnergy)} cal</div>
              <div style="margin-bottom:12px;">Energy Lost: ${Math.round(meal.wastedEnergy)} cal</div>
              <div style="font-weight:bold;margin-bottom:5px;">Individual Items:</div>
              <ul style="margin-top:0;padding-left:20px;">
                ${meal.originalMeals.map(item => `
                  <li>${item.name} - ${item.calories} cal (${Math.round(item.efficiency)}% efficient)</li>
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
      
      // Potential energy bar (wasted energy)
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
        .attr("stroke-dasharray", "3,3");
    });

    if (chronologicalData.length > 0) {
      // Calculate x positions for the line based on the actual bar positions
      const lineData = chronologicalData.map((meal, index) => {
        const barX = xOuter(meal.date) + xInner(meal.mealType);
        const barWidth = xInner.bandwidth();
        const barCenterX = barX + (barWidth / 2);
        
        return {
          ...meal,
          xPos: barCenterX,
          chronologicalIndex: index
        };
      });

      // Sort lineData by x position to ensure left-to-right flow
      const sortedLineData = [...lineData].sort((a, b) => a.xPos - b.xPos);
      
      const lineGenerator = d3.line()
        .x(d => d.xPos)
        .y(d => yEff(d.efficiency))
        .defined(d => d.efficiency != null && !isNaN(d.efficiency))
        .curve(d3.curveMonotoneX);
      
      svg.append("path")
        .datum(sortedLineData)
        .attr("fill", "none")
        .attr("stroke", "grey")
        .attr("stroke-width", 3)
        .attr("d", lineGenerator);
      
      // Add efficiency points
      svg.selectAll(".efficiency-point")
        .data(sortedLineData)
        .enter()
        .append("circle")
        .attr("class", "efficiency-point")
        .attr("cx", d => d.xPos)
        .attr("cy", d => yEff(d.efficiency))
        .attr("r", 5)
        .attr("fill", "grey")
        .attr("stroke", "#333")
        .attr("stroke-width", 1)
        .on("mouseover", function(event, d) {
          d3.select(this).attr("r", 8);
          tooltip
            .style("visibility", "visible")
            .html(`
              <div style="font-weight:bold;font-size:16px;">${d.mealType} - ${d.time}</div>
              <div style="font-weight:bold;font-size:14px;">${d.date}</div>
              <div>Enhanced Efficiency: <strong>${d.efficiency}%</strong></div>
              <div style="margin-top:6px">Calculated using enhanced Long COVID algorithms</div>
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
    const legendY = height + 100;
    
    svg.append("line")
      .attr("x1", 10)
      .attr("x2", 40)
      .attr("y1", legendY)
      .attr("y2", legendY)
      .attr("stroke", "grey")
      .attr("stroke-width", 3);
    
    svg.append("circle")
      .attr("cx", 25)
      .attr("cy", legendY)
      .attr("r", 5)
      .attr("fill", "grey")
      .attr("stroke", "#333")
      .attr("stroke-width", 1);
    
    svg.append("text")
      .attr("x", 50)
      .attr("y", legendY + 4)
      .style("font-size", "12px")
      .text("Enhanced Efficiency (%)");
    
    const legendData = [
      { label: "Usable Energy", color: "#DC2626", opacity: 0.9 },
      { label: "Energy Lost", color: "#DC2626", opacity: 0.3 }
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
    
    // Meal type legend
    const mealTypeData = Object.entries(mealColors).map(([type, color]) => ({ type, color }));
    
    svg.selectAll(".meal-type-rect")
      .data(mealTypeData)
      .enter()
      .append("rect")
      .attr("x", (d, i) => 400 + Math.floor(i/3) * 140)
      .attr("y", (d, i) => legendY - 10 + (i % 3) * 20)
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", d => d.color)
      .attr("stroke", "#333")
      .attr("stroke-width", 1);
    
    svg.selectAll(".meal-type-text")
      .data(mealTypeData)
      .enter()
      .append("text")
      .attr("x", (d, i) => 425 + Math.floor(i/3) * 140)
      .attr("y", (d, i) => legendY + 2 + (i % 3) * 20)
      .style("font-size", "12px")
      .text(d => d.type);

    return () => {
      d3.select(".chart-tooltip").remove();
    };
  }, [chartRef, processedData, userData]);

  if (!processedData || processedData.length === 0) {
    return (
      <div className="chart-container" style={{ width: '100%', minHeight: '300px' }}>
        <div ref={chartRef} className="efficiency-chart">
          <div className="placeholder">
            <p>No meal data available for enhanced efficiency analysis.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: '900px', display: 'flex', flexDirection: 'column' }}>
      <div ref={chartRef} className="efficiency-chart" style={{ 
        height: '600px', 
        width: '100%', 
        overflow: 'visible',
        flexShrink: 0
      }}></div>
      
      {/* Description section - now separate and guaranteed to be visible */}
      <div style={{ 
        marginTop: '40px', 
        padding: '25px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px',
        width: '100%',
        boxSizing: 'border-box',
        flexShrink: 0,
        border: '1px solid #dee2e6'
      }}>
        <h4 style={{ 
          marginTop: '0', 
          marginBottom: '20px', 
          fontSize: '20px', 
          fontWeight: 'bold',
          color: '#333'
        }}>
          Enhanced Metabolic Efficiency
        </h4>
        <p style={{ 
          marginBottom: '20px', 
          lineHeight: '1.6',
          fontSize: '16px',
          color: '#555'
        }}>
          This enhanced chart uses advanced algorithms that take into account Long COVID severity, meal timing, 
          macronutrient balance, and individual factors to provide more accurate efficiency calculations for 
          energy management. The efficiency line follows proper chronological order.
        </p>
        <div style={{ marginTop: '20px' }}>
          <strong style={{ fontSize: '18px', color: '#333' }}>Enhanced Features:</strong>
          <ul style={{ 
            marginTop: '15px', 
            paddingLeft: '30px', 
            lineHeight: '1.8',
            fontSize: '15px',
            color: '#555'
          }}>
            <li style={{ marginBottom: '8px' }}>Long COVID severity adjustments (metabolic efficiency factors)</li>
            <li style={{ marginBottom: '8px' }}>Circadian rhythm timing optimization</li>
            <li style={{ marginBottom: '8px' }}>Macronutrient balance scoring</li>
            <li style={{ marginBottom: '8px' }}>Anti-inflammatory food benefits/cautions</li>
            <li style={{ marginBottom: '8px' }}>Chronologically ordered efficiency tracking</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

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

const BulletChart = ({ data, maxPercent }) => {
const actualWidth = Math.min(100, (data.rawValue / data.rda) * 100);
const displayPercentage = Math.round((data.rawValue / data.rda) * 100);
const optimalWidth = Math.min(100, 100);

// Debug: Log the actual data being passed to BulletChart
console.log(`BulletChart Debug - ${data.name}:`, {
  storedValue: data.value,
  rawValue: data.rawValue,
  rda: data.rda,
  calculatedPercentage: (data.rawValue / data.rda) * 100,
  displayPercentage: displayPercentage,
  actualWidth: actualWidth,
  shouldBeOptimal: data.value >= 100 || displayPercentage >= 100
});

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
        {data.rawValue.toFixed(2)} / {data.rda} {data.unit}
        <span className="bullet-chart-percentage" style={{ color: barColor }}>
          ({displayPercentage}%)
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

function MicronutrientChart({ data, userData }) {
  const [userInfo, setUserInfo] = useState(userData || {});
  const [chartData, setChartData] = useState([]);
  const [allChartData, setAllChartData] = useState([]);
  // FIXED: Use baseRDAData10 from the global scope for ensureCompleteNutrientData
  const [nutrientIntake] = useState(data && Object.keys(data).length > 0 ? ensureCompleteNutrientData(data, baseRDAData10) : {});
  const [personalizedRDA, setPersonalizedRDA] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [displayMode, setDisplayMode] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Helper function to get severity factor
  const getSeverityFactor = useCallback((severity) => {
    switch (severity?.toLowerCase()) {
      case 'mild': return 1.1;
      case 'moderate': return 1.3;
      case 'severe': return 1.5;
      case 'very severe': return 1.8;
      default: return 1.0;
    }
  }, []);

  // Helper function to standardize units for comparison
  // eslint-disable-next-line no-unused-vars
  const standardizeUnitValue = useCallback((value, fromUnit, toUnit) => {
    if (fromUnit === toUnit) return value;

    if (fromUnit === 'g' && toUnit === 'mg') return value * 1000;
    if (fromUnit === 'mg' && toUnit === 'mcg') return value * 1000;
    if (fromUnit === 'mcg' && toUnit === 'mg') return value * 0.001;
    if (fromUnit === 'mg' && toUnit === 'g') return value * 0.001;

    console.warn(`Unit conversion from ${fromUnit} to ${toUnit} not defined for value ${value}`);
    return value;
  }, []);

  // Helper function to convert from IU units
  // eslint-disable-next-line no-unused-vars
  const convertFromIU = useCallback((nutrient, value, inputUnit) => {
    if (inputUnit?.toUpperCase() !== 'IU') return value;

    const conversionFactors = {
      vitamin_a: 0.3,     // 1 IU = ~0.3 mcg RAE (approximation)
      vitamin_d: 0.025,   // 1 IU = 0.025 mcg (40 IU = 1 mcg)
      vitamin_e: 0.67     // 1 IU = 0.67 mg alpha-tocopherol
    };

    return value * (conversionFactors[nutrient] || 1);
  }, []);

  // FIXED: Helper function to process nutrient data into chart format
  const processNutrientData = useCallback((intakeData, rdaData) => {
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
      
      // FIXED: Validate percentage is reasonable
      if (percentOfRDA > 10000) {
        console.warn(`⚠️ Extremely high percentage for ${nutrientKey}: ${percentOfRDA}% - possible unit error`);
      }
      
      // Format name and determine category
      const formattedName = nutrientKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const category = nutrientKey.includes('vitamin') ? 'vitamins' : 'minerals';

      const processedNutrient = {
        key: nutrientKey,
        name: formattedName,
        value: Math.round(percentOfRDA), // Round to avoid floating point precision issues
        rawValue: intakeValue,
        unit: rdaInfo.unit,
        rda: rdaInfo.value,
        rdaUnit: rdaInfo.unit,
        isAdjustedRDA: rdaInfo.isAdjusted || false,
        percentOfRDA: Math.round(percentOfRDA), // Keep both for compatibility
        category: category,
      };
      
      console.log(`✅ ${formattedName}: ${intakeValue}${rdaInfo.unit} / ${rdaInfo.value}${rdaInfo.unit} = ${percentOfRDA.toFixed(1)}%`);
      
      processedNutrients.push(processedNutrient);
    }

    // Sort by percentage (low to high for easier identification of deficiencies)
    const sortedNutrients = processedNutrients.sort((a, b) => a.percentOfRDA - b.percentOfRDA);
    
    console.log('=== PROCESSING SUMMARY ===');
    console.log('Total nutrients processed:', sortedNutrients.length);
    console.log('Deficient (<70%):', sortedNutrients.filter(n => n.value < 70).length);
    console.log('Optimal (≥100%):', sortedNutrients.filter(n => n.value >= 100).length);
    
    // Debug: Show nutrients that are >= 100%
    const optimalNutrients = sortedNutrients.filter(n => n.value >= 100);
    console.log('Optimal nutrients:', optimalNutrients.map(n => `${n.name}: ${n.value}%`));
    
    console.log('=== END FIXED processNutrientData ===\n');
    
    return sortedNutrients;
  }, []);

  const applyFilters = useCallback((dataToFilter) => {
    let filteredData = [...dataToFilter];

    if (selectedCategory !== 'all') {
      filteredData = filteredData.filter(item => item.category === selectedCategory);
    }

    console.log('=== FILTER DEBUG ===');
    console.log('Before filtering:', filteredData.length, 'items');
    console.log('Display mode:', displayMode);
    console.log('Sample data values:', filteredData.slice(0, 3).map(item => `${item.name}: ${item.value}%`));
    
    if (displayMode === 'deficient') {
      filteredData = filteredData.filter(item => item.value < 70);
      filteredData.sort((a, b) => a.value - b.value);
      console.log('After deficient filter:', filteredData.length, 'items');
    } else if (displayMode === 'optimal') {
      const beforeOptimal = filteredData.length;
      filteredData = filteredData.filter(item => {
        console.log(`Checking ${item.name}: ${item.value}% >= 100? ${item.value >= 100}`);
        return item.value >= 100;
      });
      console.log(`Optimal filter: ${beforeOptimal} → ${filteredData.length} items`);
      console.log('Optimal items:', filteredData.map(n => `${n.name}: ${n.value}%`));
      filteredData.sort((a, b) => b.value - a.value);
    } else {
      filteredData.sort((a, b) => a.value - b.value);
    }

    console.log('Final filtered data:', filteredData.length, 'items');
    console.log('=== END FILTER DEBUG ===');

    setChartData(filteredData);
  }, [displayMode, selectedCategory]);

  const calculatePersonalizedRDA = useCallback((baseRDAData_, userData) => {
    if (!baseRDAData_ || Object.keys(baseRDAData_).length === 0) {
      console.error('baseRDAData_ is empty or invalid!');
      return {};
    }

    const personalRDA = JSON.parse(JSON.stringify(baseRDAData_));

    Object.keys(personalRDA).forEach(nutrient => {
      if (!personalRDA[nutrient] || typeof personalRDA[nutrient].value !== 'number') {
        console.error(`Invalid data structure for ${nutrient} in baseRDAData_ or copy:`, personalRDA[nutrient]);
        personalRDA[nutrient] = { value: 0, unit: personalRDA[nutrient]?.unit || 'mg', isAdjusted: false };
        return;
      }

      let adjustedValue = personalRDA[nutrient].value;

      // Apply gender adjustment
      if (userData?.gender && userData.gender.toLowerCase() === 'female') {
        const femaleAdjust = personalRDA[nutrient].femaleAdjust || 1.0;
        adjustedValue *= femaleAdjust;
      }

      // Apply age adjustments
      if (userData?.age) {
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
        }
      }

      // Apply COVID severity adjustments
      const severity = userData?.covid_severity || userData?.longCovidSeverity;
      const hasCovidCondition = severity && severity !== 'None' && severity !== null && severity !== undefined;

      if (hasCovidCondition) {
        const severityFactor = getSeverityFactor(severity);

        if (['vitamin_c', 'vitamin_d', 'zinc', 'selenium'].includes(nutrient)) {
          const covidMultiplier = Math.min(severityFactor * 1.5, 2.5);
          adjustedValue *= covidMultiplier;
        } else if (['vitamin_a', 'vitamin_e', 'vitamin_b6', 'vitamin_b12', 'folate', 'iron'].includes(nutrient)) {
          const covidMultiplier = Math.min(severityFactor * 1.3, 2.0);
          adjustedValue *= covidMultiplier;
        } else if (['magnesium', 'copper', 'vitamin_b1', 'vitamin_b2', 'vitamin_b3'].includes(nutrient)) {
          const covidMultiplier = Math.min(severityFactor * 1.1, 1.5);
          adjustedValue *= covidMultiplier;
        }
      }

      // Final safety check
      if (isNaN(adjustedValue) || !isFinite(adjustedValue) || adjustedValue <= 0) {
        console.error(`Invalid final value for ${nutrient}: ${adjustedValue}, resetting to base`);
        adjustedValue = personalRDA[nutrient].value;
      }

      const roundedValue = Math.round(adjustedValue * 10) / 10;

      personalRDA[nutrient] = {
        ...personalRDA[nutrient],
        value: roundedValue,
        isAdjusted: roundedValue !== baseRDAData_[nutrient].value
      };
    });

    return personalRDA;
  }, [getSeverityFactor]);

  // Get nutrient status label and color
  const getNutrientStatus = (percentValue) => {
    if (percentValue >= 100) return { label: "Optimal", color: "#4CAF50" };
    if (percentValue >= 70) return { label: "Good", color: "#8BC34A" };
    if (percentValue >= 50) return { label: "Moderate", color: "#FFC107" };
    if (percentValue >= 30) return { label: "Low", color: "#FF9800" };
    return { label: "Very Low", color: "#F44336" };
  };

  // Helper function to provide nutrient-specific info
  const getNutrientInfo = (nutrientName) => {
    const nutrientInfoMap = {};
    for (const key in baseRDAData10) {
        nutrientInfoMap[key.replace(/_/g, ' ')] = baseRDAData10[key].description;
    }

    const exactMatch = nutrientInfoMap[nutrientName.toLowerCase()];
    if (exactMatch) return exactMatch;

    for (const key in nutrientInfoMap) {
      if (nutrientName.toLowerCase().includes(key)) {
        return nutrientInfoMap[key];
      }
    }
    return '';
  };

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      try {
        const calculatedRDA = calculatePersonalizedRDA(baseRDAData10, userInfo);

        if (!calculatedRDA || Object.keys(calculatedRDA).length === 0) {
          console.error('Failed to calculate RDA values');
          setIsLoading(false);
          return;
        }

        setPersonalizedRDA(calculatedRDA);

        const processedAllData = processNutrientData(nutrientIntake, calculatedRDA);
        
        // Debug: Log the processed data before setting state
        console.log('=== PROCESSED DATA DEBUG ===');
        console.log('Total processed nutrients:', processedAllData.length);
        processedAllData.forEach(nutrient => {
          console.log(`${nutrient.name}: value=${nutrient.value}%, rawValue=${nutrient.rawValue}, rda=${nutrient.rda}`);
        });
        
        const optimalCount = processedAllData.filter(n => n.value >= 100).length;
        console.log('Optimal count (≥100%):', optimalCount);
        console.log('=== END PROCESSED DATA DEBUG ===');
        
        setAllChartData(processedAllData);

        applyFilters(processedAllData);

      } catch (error) {
        console.error('Error in MicronutrientChart useEffect:', error);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [userInfo, nutrientIntake, calculatePersonalizedRDA, processNutrientData, applyFilters]);

  useEffect(() => {
    if (allChartData.length > 0) {
      applyFilters(allChartData);
    }
  }, [displayMode, selectedCategory, allChartData, applyFilters]);

  const getCovidSeverityClass = (severity) => {
    switch(severity?.toLowerCase()) {
      case 'mild': return 'covid-severity-mild';
      case 'moderate': return 'covid-severity-moderate';
      case 'severe': return 'covid-severity-severe';
      case 'very severe': return 'covid-severity-very-severe';
      default: return 'covid-severity-unknown';
    }
  };

  const toggleCovidSeverity = () => {
    const severities = [null, 'mild', 'moderate', 'severe', 'very severe'];
    const currentSeverity = userInfo.covid_severity?.toLowerCase() || userInfo.longCovidSeverity?.toLowerCase() || null;
    const currentIndex = severities.indexOf(currentSeverity);
    const nextIndex = (currentIndex + 1) % severities.length;
    const newSeverity = severities[nextIndex];

    const updatedUserInfo = {
      ...userInfo,
      covid_severity: newSeverity,
      longCovidSeverity: newSeverity,
      hasLongCovid: newSeverity !== null
    };

    if (newSeverity === null) {
      delete updatedUserInfo.covid_severity;
      delete updatedUserInfo.longCovidSeverity;
      updatedUserInfo.hasLongCovid = false;
    }

    setUserInfo(updatedUserInfo);
  };

  const getCurrentCovidSeverity = () => {
    const severity = userInfo.covid_severity || userInfo.longCovidSeverity;
    if (!severity || severity === null || severity === 'None') return 'None';
    return severity.charAt(0).toUpperCase() + severity.slice(1);
  };

  const changeDisplayMode = (mode) => {
    setDisplayMode(mode);
  };

  const changeCategory = (category) => {
    setSelectedCategory(category);
  };

  const getFilterDescription = () => {
    const displayPart = displayMode === 'deficient' ? "below 70% RDA" : displayMode === 'optimal' ? "at 100%+ RDA" : "";
    const categoryPart = selectedCategory === 'vitamins' ? "vitamins" : selectedCategory === 'minerals' ? "minerals" : "nutrients";

    let description = categoryPart;
    if (displayPart) {
        description += ` ${displayPart}`;
    }
    return description.trim();
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

  const deficientCount = allChartData.filter(item => item.value < 70).length;

  // Show empty state if no user data AND no meal data
  if ((!data || Object.keys(data).length === 0) && (!userData || Object.keys(userData).length === 0)) {
    return (
      <div className="micronutrient-chart-container">
        <div className="chart-card">
          <div className="chart-header">
            <h2 className="chart-title">Micronutrient Status</h2>
          </div>
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3 className="empty-state-title">No Data Available</h3>
            <p className="empty-state-description">
              Please set up your profile and log some meals to see your personalized micronutrient analysis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show empty state if user data exists but no meal data, or no processed data at all
  if (!data || Object.keys(data).length === 0 || allChartData.length === 0) {
    return (
      <div className="micronutrient-chart-container">
        <div className="chart-card">
          <div className="chart-header">
            <h2 className="chart-title">Micronutrient Status</h2>
          </div>
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3 className="empty-state-title">No Micronutrient Data Available</h3>
            <p className="empty-state-description">
              Once you log some meals, we'll analyze your nutrient intake and show your personalized micronutrient status here.
            </p>
          </div>
        </div>
        <div className="profile-card">
          <h3 className="profile-title">User Profile</h3>
          <div className="profile-grid">
            <div className="profile-item">
              <p className="profile-label">Age</p>
              <p className="profile-value">{userInfo?.age || 'Not specified'} years</p>
            </div>
            <div className="profile-item">
              <p className="profile-label">Gender</p>
              <p className="profile-value">{userInfo?.gender ? userInfo.gender.charAt(0).toUpperCase() + userInfo.gender.slice(1) : 'Not specified'}</p>
            </div>
            <div className="profile-item">
              <p className="profile-label">BMI</p>
              <p className="profile-value">{userInfo?.weight && userInfo?.height ?
                (userInfo.weight / Math.pow(userInfo.height/100, 2)).toFixed(1) : 'N/A'}</p>
            </div>
            <div className="profile-item">
              <p className="profile-label">Activity Level</p>
              <p className="profile-value">{userInfo?.activity_level || 'Not specified'}</p>
            </div>
            <div className="profile-item">
              <p className="profile-label">Medical Conditions</p>
              <p className="profile-value">{userInfo?.medical_conditions && userInfo.medical_conditions.length > 0 ?
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
              All ({allChartData.length})
            </button>
            <button
              onClick={() => changeDisplayMode('deficient')}
              className={`mode-button ${displayMode === 'deficient' ? 'mode-button-deficient' : ''}`}
            >
              Deficient ({deficientCount})
            </button>
            <button
              onClick={() => changeDisplayMode('optimal')}
              className={`mode-button ${displayMode === 'optimal' ? 'mode-button-optimal' : ''}`}
            >
              Optimal ({allChartData.filter(item => item.percentOfRDA >= 100).length})
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

        {userInfo.covid_severity && getCurrentCovidSeverity() !== 'None' && (
          <div className={`covid-alert ${getCovidSeverityClass(userInfo.covid_severity)}`}>
            <p className="covid-title">Long COVID Condition - {getCurrentCovidSeverity()} Severity</p>
            <p className="covid-description">Recommended values have been adjusted for immune system support</p>
          </div>
        )}

        <div className="chart-content">
          {chartData.length === 0 && allChartData.length > 0 ? (
            <div className="no-filter-results">
              <div className="no-results-icon">🎯</div>
              <h3 className="no-results-title">Great news!</h3>
              <p className="no-results-message">
                You don't have any {getFilterDescription()} to display.
                {displayMode === 'deficient' && " This means your nutrient levels are doing well in this category!"}
                {displayMode === 'optimal' && " Try logging more diverse meals to reach optimal levels."}
              </p>
              <p className="no-results-suggestion">
                Try selecting "All" to see your complete nutrient profile.
              </p>
            </div>
          ) : (
            chartData.map((nutrient) => (
              <BulletChart
                key={nutrient.key}
                data={nutrient}
                maxPercent={150}
                getNutrientStatus={getNutrientStatus}
                getNutrientInfo={getNutrientInfo}
              />
            ))
          )}
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
            <p className="profile-value">{userInfo?.age || 'Not specified'} years</p>
          </div>
          <div className="profile-item">
            <p className="profile-label">Gender</p>
            <p className="profile-value">{userInfo?.gender ? userInfo.gender.charAt(0).toUpperCase() + userInfo.gender.slice(1) : 'Not specified'}</p>
          </div>
          <div className="profile-item">
            <p className="profile-label">BMI</p>
            <p className="profile-value">{userInfo?.weight && userInfo?.height ?
              (userInfo.weight / Math.pow(userInfo.height/100, 2)).toFixed(1) : 'N/A'}</p>
          </div>
          <div className="profile-item">
            <p className="profile-label">Activity Level</p>
            <p className="profile-value">{userInfo?.activity_level || 'Not specified'}</p>
          </div>
          <div className="profile-item">
            <p className="profile-label">Medical Conditions</p>
            <p className="profile-value">{userInfo?.medical_conditions && userInfo.medical_conditions.length > 0 ?
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

// FIXED: Enhanced getChartData function with better micronutrient processing
function getChartData(foodLog, userProfile) {
  if (!foodLog || !Array.isArray(foodLog)) {
    return { macroSums: {}, microSums: {}, efficiencyData: [] };
  }

  if (foodLog.length === 0) {
    return { macroSums: {}, microSums: {}, efficiencyData: [] };
  }

  //const lastDate = foodLog[0].date;
  const today = formatDateForComparison(new Date());
  //const lastDayEntries = foodLog.filter(e => e.date === lastDate);
  const todayEntries = foodLog.filter(e => e.date === today);
  
  console.log('=== FIXED getChartData DEBUG ===');
  //console.log('Processing', lastDayEntries.length, 'entries for date:', lastDate);
    // ADD THIS CHECK:
    if (todayEntries.length === 0) {
      return { macroSums: {}, microSums: {}, efficiencyData: foodLog };
    }
  // Calculate macro sums with validation
  //const macroSums = lastDayEntries.reduce((acc, e) => {

    const macroSums = todayEntries.reduce((acc, e) => {

    const protein = parseFloat(e.protein) || 0;
    const carbs = parseFloat(e.carbs) || 0;
    const fat = parseFloat(e.fat) || 0;
    const calories = parseFloat(e.calories) || 0;
    
    acc.protein = (acc.protein || 0) + protein;
    acc.carbs = (acc.carbs || 0) + carbs;
    acc.fat = (acc.fat || 0) + fat;
    acc.calories = (acc.calories || 0) + calories;
    
    console.log(`✅ Entry: ${e.name} - P:${protein}g C:${carbs}g F:${fat}g Cal:${calories}`);
    return acc;
  }, {});
  
  // FIXED: Better micronutrient accumulation with unit validation
  const microSums = {};
  
  //lastDayEntries.forEach((entry, entryIndex) => {
    todayEntries.forEach((entry, entryIndex) => {
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
          console.warn(`❌ Object format not recognized for ${nutrientKey}:`, nutrientValue);
          return;
        }
      } else if (typeof nutrientValue === 'number') {
        valueToAdd = nutrientValue;
      } else if (typeof nutrientValue === 'string') {
        valueToAdd = parseFloat(nutrientValue) || 0;
      } else {
        console.warn(`❌ Unrecognized value format for ${nutrientKey}:`, nutrientValue);
        return;
      }
      
      // FIXED: Unit standardization for common problem nutrients
      if (nutrientKey === 'zinc' || nutrientKey === 'selenium' || nutrientKey === 'copper') {
        // These are often given in mcg but should be in mg for zinc/copper
        if (unit === 'mcg' || unit === 'μg') {
          if (nutrientKey === 'zinc' || nutrientKey === 'copper') {
            valueToAdd = valueToAdd / 1000; // Convert mcg to mg
            unit = 'mg';
            console.log(`🔄 Converted ${nutrientKey} from mcg to mg: ${valueToAdd}`);
          }
          // Selenium should stay in mcg, so don't convert
        }
      }
      
      // FIXED: Validate the value is reasonable
      const reasonableMaxValues = {
        'zinc': 50,           // mg
        'selenium': 400,      // mcg
        'copper': 10,         // mg
        'iron': 100,          // mg
        'vitamin_c': 2000,    // mg
        'vitamin_d': 100,     // mcg
        'calcium': 3000,      // mg
        'magnesium': 1000     // mg
      };
      
      const maxValue = reasonableMaxValues[nutrientKey] || 10000;
      if (valueToAdd < 0 || valueToAdd > maxValue) {
        console.warn(`⚠️ Suspicious ${nutrientKey} value: ${valueToAdd} ${unit} (max expected: ${maxValue}) - using cautiously`);
        // Don't skip entirely, but cap the value
        valueToAdd = Math.min(valueToAdd, maxValue);
      }
      
      // Initialize or add to sum
      if (!microSums[nutrientKey]) {
        microSums[nutrientKey] = { value: 0, unit: unit };
      }
      
      microSums[nutrientKey].value += valueToAdd;
      
      console.log(`➕ ${nutrientKey}: +${valueToAdd} ${unit} → Total: ${microSums[nutrientKey].value} ${unit}`);
    });
  });
  
  console.log('\n=== FINAL SUMS ===');
  console.log('Macros:', macroSums);
  console.log('Micros:', microSums);
  
  // FIXED: Validate final micronutrient totals
  Object.entries(microSums).forEach(([nutrient, data]) => {
    const warningThresholds = {
      'zinc': 100,        // mg - warning if > 100mg
      'selenium': 1000,   // mcg - warning if > 1000mcg  
      'copper': 50,       // mg - warning if > 50mg
      'iron': 200,        // mg - warning if > 200mg
      'vitamin_c': 5000,  // mg - warning if > 5000mg
    };
    
    const threshold = warningThresholds[nutrient] || 1000;
    if (data.value > threshold) {
      console.warn(`⚠️ Unusually high ${nutrient}: ${data.value} ${data.unit} (threshold: ${threshold})`);
    }
  });
  
  console.log('=== END FIXED DEBUG ===\n');
  
  return { 
    macroSums, 
    microSums, 
    efficiencyData: foodLog 
  };
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

// FIXED: Use timezone-safe date comparison
const today = formatDateForComparison(new Date());
const analysisDate = foodLog.length > 0 ? foodLog[0].date : today;
const todayMeals = foodLog.filter(entry => entry.date === today);
const { macroSums, microSums, efficiencyData } = getChartData(foodLog, userProfile);

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
      
      <div className="chart-wrapper">
        <div className="chart-header">
          <h4>⚡ Metabolic Efficiency</h4>
          <p className="chart-description">How effectively your body converts food calories into usable energy</p>
        </div>
        <div style={{ width: '100%', overflow: 'visible' }}>
          <EfficiencyChart data={efficiencyData} userData={userProfile} />
        </div>
      </div>

    </div>
  </div>
);
}

export { AnalysisTab, MacronutrientChart, MicronutrientChart, EfficiencyChart };