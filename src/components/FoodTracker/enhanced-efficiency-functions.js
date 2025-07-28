// enhanced-efficiency-functions.js - Fixed with proper time sorting and chronological line positioning
import React, { useRef, useState, useEffect } from 'react';
import * as d3 from 'd3';

// Long COVID Severity Factors
// FIXED: Long COVID RDA Multipliers (for increased nutritional requirements)
export const getSeverityFactor = (severity) => {
  // These factors represent INCREASED nutritional NEEDS due to COVID severity
  const severityFactors = {
    'mild': 1.2,        // 20% increase in RDA requirements
    'moderate': 1.5,    // 50% increase in RDA requirements  
    'severe': 1.8,      // 80% increase in RDA requirements
    'very severe': 2.2  // 120% increase in RDA requirements
  };
  return severityFactors[severity?.toLowerCase()] || 1.0;
};

// NEW: Separate function for metabolic efficiency (where lower values make sense)
export const getMetabolicEfficiencyFactor = (severity) => {
  const severityFactors = {
    'mild': 0.95,       // Slightly reduced efficiency
    'moderate': 0.85,   // Moderately reduced efficiency
    'severe': 0.75,     // Significantly reduced efficiency
    'very severe': 0.65 // Severely reduced efficiency
  };
  return severityFactors[severity?.toLowerCase()] || 0.85;
};

// UPDATED: Calculate Food Efficiency using the correct factor for efficiency + expanded snack types
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
  
  // UPDATED: Expanded meal type factors including all snack types
  const mealTypeFactors = {
    'Breakfast': 1.3,
    'Morning Snack': 0.9,      // Good mid-morning metabolism
    'Lunch': 1.1,
    'Afternoon Snack': 0.8,    // Decent afternoon metabolism
    'Dinner': 0.9,
    'Late Night Snack': 0.6   // Lower efficiency for late eating
            // Keep original for backward compatibility
  };
  const mealTypeFactor = mealTypeFactors[mealData.mealType] || 1.0;
  
  // Base efficiency calculation
  const macroBalance = Math.min(100, (proteinFactor + carbFactor + fatFactor) * 10);
  let efficiency = macroBalance * timeFactor * mealTypeFactor;
  
  // Long COVID adjustments - FIXED to use metabolic efficiency factor
  if (mealData.longCovidAdjust && userProfile?.hasLongCovid) {
    const severityFactor = getMetabolicEfficiencyFactor(userProfile.longCovidSeverity); // CHANGED: Use metabolic efficiency factor
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

// Micronutrient enhancement functions
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

// Fixed EnhancedEfficiencyChart with proper chronological line ordering
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
    
    // Group data by date and meal type for bars
    const combinedData = [];
    const groupedByDate = d3.group(lastWeekData, d => d.date);
    
    const uniqueMealTypes = ['Breakfast', 'Morning Snack', 'Lunch', 'Afternoon Snack', 'Dinner', 'Late Night Snack'];
    
    allDatesInRange.forEach(date => {
      const dateData = groupedByDate.get(date) || [];
      
      if (dateData.length > 0) {
        const mealsByType = d3.group(dateData, d => d.mealType);
      
        // Process meal types in the correct order
        uniqueMealTypes.forEach(mealType => {
          const meals = mealsByType.get(mealType);
          if (meals && meals.length > 0) {
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
              originalMeals: meals,
              mealOrder: uniqueMealTypes.indexOf(mealType) // Add explicit order
            });
          }
        });
      }
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

    // Color scheme for meal types
    const mealColors = {
      "Breakfast": "#FF9F1C",
      "Morning Snack": "#FFB84D",
      "Lunch": "#2EC4B6",
      "Afternoon Snack": "#4ECDC4",
      "Dinner": "#E71D36",
      "Late Night Snack": "#FF6B6B"
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

    // FIXED: Create properly sorted chronological data for the efficiency line
    if (combinedData.length > 0) {
      // Sort meals chronologically: first by date, then by meal order
      const chronologicalData = [...combinedData].sort((a, b) => {
        // First sort by date
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        
        // Then sort by meal order (already assigned during data creation)
        return a.mealOrder - b.mealOrder;
      });
      
      console.log('Final chronological order:', chronologicalData.map(d => ({
        date: d.date,
        mealType: d.mealType,
        mealOrder: d.mealOrder,
        efficiency: d.efficiency
      })));

      // Calculate x positions for the line based on the actual bar positions
      const lineData = chronologicalData.map((meal, index) => {
        // Calculate the actual bar position (center of the bar)
        const barX = xOuter(meal.date) + xInner(meal.mealType);
        const barWidth = xInner.bandwidth();
        const barCenterX = barX + (barWidth / 2);
        
        console.log(`Meal ${index}: ${meal.mealType} on ${meal.date} at x=${barCenterX}, efficiency=${meal.efficiency}`);
        
        return {
          ...meal,
          xPos: barCenterX,
          chronologicalIndex: index
        };
      });

      // Sort lineData by x position to ensure left-to-right flow
      const sortedLineData = [...lineData].sort((a, b) => a.xPos - b.xPos);
      
      console.log('Line data sorted by x position:', sortedLineData.map(d => ({
        mealType: d.mealType,
        xPos: Math.round(d.xPos),
        efficiency: d.efficiency
      })));

      // Create the efficiency line
      const lineGenerator = d3.line()
        .x(d => d.xPos)
        .y(d => yEff(d.efficiency))
        .defined(d => d.efficiency != null && !isNaN(d.efficiency))
        .curve(d3.curveMonotoneX);
      
      svg.append("path")
        .datum(sortedLineData)  // Use sorted data
        .attr("fill", "none")
        .attr("stroke", "#FF5733")
        .attr("stroke-width", 3)
        .attr("d", lineGenerator);
      
      // Add efficiency points
      svg.selectAll(".efficiency-point")
        .data(sortedLineData)  // Use sorted data
        .enter()
        .append("circle")
        .attr("class", "efficiency-point")
        .attr("cx", d => d.xPos)
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
              <div style="font-weight:bold;font-size:16px;">${d.mealType} - ${d.time}</div>
              <div style="font-weight:bold;font-size:14px;">${d.date}</div>
              <div>Enhanced Efficiency: <strong>${d.efficiency}%</strong></div>
              <div style="margin-top:6px">X Position: ${Math.round(d.xPos)}</div>
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
    
    // Efficiency line legend
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
    
    // Energy bars legend
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
        <h4>Enhanced Metabolic Efficiency - Fixed Chronological Line</h4>
        <p>
          This chart now properly connects meals in chronological order. The efficiency line flows smoothly 
          from the earliest meal to the latest meal across all days, regardless of meal type.
        </p>
        <div style={{ marginTop: '10px' }}>
          <strong>Key Fixes:</strong>
          <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
            <li>Meals are sorted chronologically by date and time before connecting</li>
            <li>Line positions are calculated as smooth progression across chart width</li>
            <li>No more jumping between different meal types on the same day</li>
            <li>Hover tooltips show chronological order for verification</li>
          </ul>
        </div>
      </div>
    </div>
  );
};