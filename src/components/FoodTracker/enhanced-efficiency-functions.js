// enhanced-efficiency-functions.js - Fixed with proper imports and structure
import React, { useRef, useState, useEffect } from 'react';
import * as d3 from 'd3';

// Long COVID Severity Factors
export const getSeverityFactor = (severity) => {
  const severityFactors = {
    'mild': 0.95,
    'moderate': 0.85,
    'severe': 0.75,
    'very severe': 0.65
  };
  return severityFactors[severity?.toLowerCase()] || 0.85;
};

// Calculate Food Efficiency based on Long COVID factors
export const calculateFoodEfficiency = (mealData, userProfile) => {
  const timeStr = mealData.time;
  const hourMatch = timeStr.match(/(\d+):/);
  const hour = hourMatch ? parseInt(hourMatch[1], 10) : 12;
  const isPM = timeStr.toLowerCase().includes('pm');
  
  let hour24 = hour;
  if (isPM && hour !== 12) hour24 += 12;
  if (!isPM && hour === 12) hour24 = 0;
  
  // Macronutrient factors
  const proteinFactor = (parseFloat(mealData.protein) || 0) * 0.2;
  const carbFactor = (parseFloat(mealData.carbs) || 0) * 0.1;
  const fatFactor = (parseFloat(mealData.fat) || 0) * 0.15;
  
  // Circadian rhythm factors
  let timeFactor = 1.0;
  if (hour24 < 6 || hour24 > 20) {
    timeFactor = 0.7;
  } else if (hour24 >= 7 && hour24 <= 10) {
    timeFactor = 1.2;
  } else if (hour24 >= 17 && hour24 <= 19) {
    timeFactor = 0.9;
  }
  
  // Meal type factors
  const mealTypeFactors = {
    'Breakfast': 1.3,
    'Lunch': 1.1,
    'Dinner': 0.9,
    'Snack': 0.8
  };
  const mealTypeFactor = mealTypeFactors[mealData.mealType] || 1.0;
  
  // Base efficiency calculation
  const macroBalance = Math.min(100, (proteinFactor + carbFactor + fatFactor) * 10);
  let efficiency = macroBalance * timeFactor * mealTypeFactor;
  
  // Long COVID adjustments
  if (mealData.longCovidAdjust && userProfile?.hasLongCovid) {
    const severityFactor = getSeverityFactor(userProfile.longCovidSeverity);
    efficiency *= severityFactor;
    
    // Boost for beneficial foods
    if (mealData.longCovidBenefits && mealData.longCovidBenefits.length > 0) {
      efficiency *= 1.1;
    }
    
    // Reduce for problematic foods
    if (mealData.longCovidCautions && mealData.longCovidCautions.length > 0) {
      efficiency *= 0.9;
    }
  }
  
  return Math.min(100, Math.max(0, efficiency));
};

// Estimate micronutrient enhancement for Long COVID
export const estimateMicronutrientEnhancement = (micronutrients, severity) => {
  const severityMultipliers = {
    'mild': 1.2,
    'moderate': 1.5,
    'severe': 1.8,
    'very severe': 2.0
  };
  
  const multiplier = severityMultipliers[severity?.toLowerCase()] || 1.0;
  const enhancedMicronutrients = {};
  
  // Key nutrients for Long COVID recovery
  const keyNutrients = [
    'vitamin_c', 'vitamin_d', 'zinc', 'selenium', 'vitamin_b6', 
    'vitamin_b12', 'folate', 'iron', 'magnesium'
  ];
  
  Object.entries(micronutrients).forEach(([nutrient, data]) => {
    if (keyNutrients.includes(nutrient)) {
      enhancedMicronutrients[nutrient] = {
        ...data,
        recommendedValue: (data.value || 0) * multiplier,
        isEnhanced: true,
        reason: `Increased for Long COVID ${severity} severity`
      };
    } else {
      enhancedMicronutrients[nutrient] = {
        ...data,
        recommendedValue: data.value || 0,
        isEnhanced: false
      };
    }
  });
  
  return enhancedMicronutrients;
};

// Standard micronutrient enhancement (non-Long COVID)
export const estimateStandardMicronutrientEnhancement = (micronutrients, userProfile) => {
  const enhancedMicronutrients = {};
  
  Object.entries(micronutrients).forEach(([nutrient, data]) => {
    let multiplier = 1.0;
    
    // Age-based adjustments
    if (userProfile.age > 65) {
      if (['vitamin_d', 'vitamin_b12', 'calcium'].includes(nutrient)) {
        multiplier *= 1.2;
      }
    }
    
    // Gender-based adjustments
    if (userProfile.gender === 'female') {
      if (nutrient === 'iron') {
        multiplier *= 2.25; // Women need more iron
      }
    }
    
    // Activity level adjustments
    if (userProfile.activityLevel === 'high' || userProfile.activityLevel === 'very_high') {
      if (['magnesium', 'iron', 'vitamin_b1', 'vitamin_b2'].includes(nutrient)) {
        multiplier *= 1.3;
      }
    }
    
    enhancedMicronutrients[nutrient] = {
      ...data,
      recommendedValue: (data.value || 0) * multiplier,
      isEnhanced: multiplier > 1.0,
      reason: multiplier > 1.0 ? 'Adjusted for demographics and activity' : 'Standard recommendation'
    };
  });
  
  return enhancedMicronutrients;
};

// Enhanced Efficiency Chart Component
export const EnhancedEfficiencyChart = ({ data, userData }) => {
  const chartRef = useRef(null);
  const [processedData, setProcessedData] = useState([]);
  
  useEffect(() => {
    if (!data || data.length === 0) return;
    
    // Process meals with enhanced efficiency calculations
    const updatedData = data.map(meal => {
      const efficiency = calculateFoodEfficiency(meal, userData);
      return {
        ...meal,
        originalEfficiency: meal.efficiency || 80,
        enhancedEfficiency: efficiency,
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
      .text("Enhanced Metabolic Efficiency Chart");
      
    // Chart subtitle
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-style", "italic")
      .text("Optimized for Long COVID energy management");
    
    // Filter data to only include the last week
    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);
    
    const lastWeekData = processedData.filter(meal => {
      try {
        const mealDate = new Date(meal.date);
        return mealDate >= oneWeekAgo;
      } catch (err) {
        console.warn('Error parsing date:', meal.date);
        return false;
      }
    });
    
    // Generate an array of all days in the past week
    const allDatesInRange = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const formattedDate = date.toISOString().split('T')[0];
      allDatesInRange.push(formattedDate);
    }
    
    // Group data by date and meal type
    const combinedData = [];
    const groupedByDate = d3.group(lastWeekData, d => d.date);
    const uniqueMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    
    allDatesInRange.forEach(date => {
      const dateData = groupedByDate.get(date) || [];
      
      if (dateData.length > 0) {
        const mealsByType = d3.group(dateData, d => d.mealType);
      
        mealsByType.forEach((meals, mealType) => {
          const totalCalories = d3.sum(meals, d => d.calories);
          const weightedEfficiency = meals.reduce((acc, meal) => {
            return acc + (meal.enhancedEfficiency * meal.calories / totalCalories);
          }, 0);
          
          const totalActualEnergy = d3.sum(meals, d => d.actualEnergy);
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
            originalMeals: meals
          });
        });
      }
    });
    




    
    const sortedCombinedData = [...combinedData].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });

    // Calculate scales
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
      return `${parts[1]}/${parts[2]}`;
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

    // Define colors for meal types
    const mealColors = {
      "Breakfast": "#FF9F1C",
      "Lunch": "#2EC4B6",
      "Dinner": "#E71D36",
      "Snack": "#011627"
    };

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
                  <li>${item.name} - ${item.calories} cal (${Math.round(item.enhancedEfficiency)}% efficient)</li>
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

    // Add efficiency line
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
        .attr("stroke-width", 1);
    }

    // Cleanup function
    return () => {
      d3.select(".chart-tooltip").remove();
    };
  }, [chartRef, processedData, userData]);
  
  if (!processedData || processedData.length === 0) {
    return (
      <div className="chart-container">
        <div ref={chartRef} className="efficiency-chart">
          <div className="placeholder">
            <p>No meal data available for enhanced efficiency analysis.</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="chart-container">
      <div ref={chartRef} className="efficiency-chart" style={{ minHeight: '500px' }}></div>
      <div className="chart-info" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <h4>Enhanced Metabolic Efficiency</h4>
        <p>
          This enhanced chart takes into account Long COVID severity, meal timing, and individual factors 
          to provide more accurate efficiency calculations for energy management.
        </p>
      </div>
    </div>
  );
};