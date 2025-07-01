import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase-config';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import * as d3 from 'd3';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const forecastChartRef = useRef(null);
  
  // Use useCallback to memoize the function and fix the dependency warning
  const checkUserAuthentication = useCallback(async () => {
    try {
      // Get user data from localStorage (set by FitbitCallback)
      const storedUserData = localStorage.getItem('userData');
      
      if (!storedUserData) {
        // No user data found, redirect to login
        navigate('/login');
        return;
      }
      
      const parsedUserData = JSON.parse(storedUserData);
      
      // Fetch full user data from Firestore using the stored user ID
      if (parsedUserData.id) {
        const userDocRef = doc(db, "users", parsedUserData.id);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          setUserData({ id: parsedUserData.id, ...userDocSnap.data() });
        } else {
          // Fallback to localStorage data if Firestore doc not found
          setUserData(parsedUserData);
        }
      } else {
        // Use localStorage data as fallback
        setUserData(parsedUserData);
      }
      
    } catch (error) {
      console.error("Error checking authentication:", error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  }, [navigate]);
  
  // Check authentication state using localStorage (matching your FitbitCallback flow)
  useEffect(() => {
    checkUserAuthentication();
  }, [checkUserAuthentication]);
  
  // Create the forecast chart using D3
  useEffect(() => {
    if (!forecastChartRef.current || loading || userData === null) return;
    
    // Clear any existing chart first
    forecastChartRef.current.innerHTML = '';
    
    createForecastChart();
    
    // Handle window resize
    const handleResize = () => {
      // Clear and redraw the chart
      if (forecastChartRef.current) {
        forecastChartRef.current.innerHTML = '';
        createForecastChart();
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [loading, userData]);
  
  const createForecastChart = () => {
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const width = forecastChartRef.current.clientWidth - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;
    
    const svg = d3.select(forecastChartRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);
      
    // Data for forecast (hours and energy levels)
    const hours = ["8AM", "10AM", "12PM", "2PM", "4PM", "6PM", "8PM"];
    const energyData = [
      { hour: "8AM", value: 90, actual: true },
      { hour: "10AM", value: 78, actual: true },
      { hour: "12PM", value: 62, actual: false },
      { hour: "2PM", value: 75, actual: false },
      { hour: "4PM", value: 68, actual: false },
      { hour: "6PM", value: 55, actual: false },
      { hour: "8PM", value: 40, actual: false }
    ];
    
    // X axis scale
    const x = d3.scaleBand()
      .range([0, width])
      .domain(hours)
      .padding(0.2);
      
    svg.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("fill", "#6b7280")
      .style("font-size", "12px");
      
    // Y axis scale
    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0]);
      
    svg.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .style("fill", "#6b7280")
      .style("font-size", "12px");
      
    // Style axis lines
    svg.selectAll(".domain, .tick line")
      .style("stroke", "#e5e7eb")
      .style("stroke-width", "1px");
      
    // Add gradient for line
    const gradient = svg.append("defs")
      .append("linearGradient")
      .attr("id", "lineGradient")
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", 0).attr("y1", 0)
      .attr("x2", 0).attr("y2", height);
      
    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#3b82f6")
      .attr("stop-opacity", 0.8);
      
    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#2563eb")
      .attr("stop-opacity", 0.8);
      
    // Add area under curve
    const area = d3.area()
      .x(d => x(d.hour) + x.bandwidth() / 2)
      .y0(height)
      .y1(d => y(d.value))
      .curve(d3.curveMonotoneX);
      
    svg.append("path")
      .datum(energyData)
      .attr("fill", "url(#lineGradient)")
      .attr("opacity", 0.1)
      .attr("d", area);
      
    // Add line path for forecast
    const line = d3.line()
      .x(d => x(d.hour) + x.bandwidth() / 2)
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);
      
    svg.append("path")
      .datum(energyData)
      .attr("fill", "none")
      .attr("stroke", "url(#lineGradient)")
      .attr("stroke-width", 3)
      .attr("d", line);
      
    // Add dots with enhanced styling
    svg.selectAll(".dot")
      .data(energyData)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", d => x(d.hour) + x.bandwidth() / 2)
      .attr("cy", d => y(d.value))
      .attr("r", 6)
      .attr("fill", d => d.actual ? "#3b82f6" : "white")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 3)
      .style("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.1))")
      .on("mouseover", function(event, d) {
        // Add tooltip on hover
        const tooltip = svg.append("g")
          .attr("class", "tooltip");
          
       /* const rect = tooltip.append("rect")
          .attr("x", x(d.hour) + x.bandwidth() / 2 - 25)
          .attr("y", y(d.value) - 35)
          .attr("width", 50)
          .attr("height", 25)
          .attr("rx", 4)
          .attr("fill", "#374151")
          .attr("opacity", 0.9);*/
          
        tooltip.append("text")
          .attr("x", x(d.hour) + x.bandwidth() / 2)
          .attr("y", y(d.value) - 18)
          .attr("text-anchor", "middle")
          .style("fill", "white")
          .style("font-size", "12px")
          .style("font-weight", "500")
          .text(`${d.value}%`);
      })
      .on("mouseout", function() {
        svg.select(".tooltip").remove();
      });
      
    // Add the current time indicator
    const currentTime = new Date().getHours();
    let timeIndex = Math.floor((currentTime - 8) / 2);
    if (timeIndex >= 0 && timeIndex < hours.length - 1) {
      const pos1 = x(hours[timeIndex]) + x.bandwidth() / 2;
      const pos2 = x(hours[timeIndex + 1]) + x.bandwidth() / 2;
      const posX = pos1 + ((pos2 - pos1) * ((currentTime % 2) / 2));
      
      svg.append("line")
        .attr("x1", posX)
        .attr("x2", posX)
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#ef4444")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5")
        .style("filter", "drop-shadow(0 1px 2px rgba(0,0,0,0.1))");
        
      svg.append("text")
        .attr("x", posX)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#ef4444")
        .text("Now");
    }
  };
  
  // Handle button click for tracking meal
  const handleTrackMeal = () => {
    console.log('CLICKED: Track Meal button');
    navigate('/food-tracker');
  };

  // Handle button click for activity dashboard
  const handleViewActivityData = () => {
    console.log('handleViewActivityData called - navigating to /fitbit-dashboard');
    navigate('/fitbit-dashboard');
  };

  // Handle navigation to personal settings
  const handlePersonalSettings = () => {
    navigate('/personal-settings');
  };
  
  const handleSymptomTracker = () => {
    console.log('CLICKED: Track Symptoms button');
    navigate('/symptom-tracker');
  };
  
  // Handle logout - Complete logout from both localStorage and Firebase Auth
  const handleLogout = async () => {
    console.log('Logout clicked - starting complete logout process');
    
    try {
      // 1. Sign out from Firebase Auth
      if (auth.currentUser) {
        console.log('Signing out Firebase user:', auth.currentUser.email);
        await signOut(auth);
        console.log('Firebase signOut successful');
      } else {
        console.log('No Firebase user to sign out');
      }
      
      // 2. Clear localStorage
      console.log('Clearing localStorage userData');
      localStorage.removeItem('userData');
      
      // 3. Clear any other potential session data
      sessionStorage.clear();
      console.log('Cleared sessionStorage');
      
      // 4. Reset component state
      setUserData(null);
      setLoading(false);
      
      console.log('Complete logout finished, navigating to login...');
      
      // 5. Navigate to login with replace to prevent back navigation
      navigate('/login', { replace: true });
      
    } catch (error) {
      console.error('Error during logout:', error);
      
      // Even if Firebase signOut fails, still clear local data and redirect
      localStorage.removeItem('userData');
      sessionStorage.clear();
      setUserData(null);
      
      navigate('/login', { replace: true });
    }
  };

  // Check if user has Fitbit connected
  const isFitbitConnected = userData?.selectedDevice === 'fitbit' && userData?.deviceConnected === true;
  
  // Show loading state
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  console.log('=== DASHBOARD DEBUG INFO ===');
  console.log('userData:', userData);
  console.log('selectedDevice:', userData?.selectedDevice);
  console.log('deviceConnected:', userData?.deviceConnected);
  console.log('isFitbitConnected:', isFitbitConnected);
  console.log('=== END DEBUG INFO ===');
  
  return (
    <div className="dashboard-container">
      {/* Animated background elements - matching SignIn page */}
      <div className="bg-animation">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
        <div className="floating-shape shape-4"></div>
        <div className="floating-shape shape-5"></div>
      </div>

      <div className="header">
        <h1>Energy Management Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {userData?.name || 'User'}!</span>
          <div className="user-actions">
            <button onClick={handlePersonalSettings} className="settings-btn">
              ⚙️ Settings
            </button>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
        <div className="date" id="current-date">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>
      
      <div className="dashboard">
        <div className="card energy-gauge-container">
          {/* Large rotating glow effect */}
          <div className="card-glow"></div>
          <div className="card-content">
            <h3 className="card-title">
              Daily Energy Forecast
              <span className="info-icon" title="Predicts how your energy levels will change throughout the day based on planned activities and historical patterns.">ⓘ</span>
            </h3>
            <div id="forecast-chart" ref={forecastChartRef} className="forecast-chart"></div>
          </div>
        </div>

        <div className="card status-summary-container">
          {/* Large rotating glow effect */}
          <div className="card-glow"></div>
          <div className="card-content">
            <h3 className="card-title">
              Quick Actions
              <span className="info-icon" title="One-tap access to common activities for logging your day and managing your condition.">ⓘ</span>
            </h3>
            <div className="quick-actions">
              <button 
                className="action-button meal" 
                onClick={handleTrackMeal}
              >
                📝 Track Meal
              </button>
              
              <button 
                className="action-button symptom" 
                onClick={handleSymptomTracker}
              >
                🩺 Track Symptoms
              </button>
              
              {isFitbitConnected ? (
                <button 
                  className="action-button activity" 
                  onClick={handleViewActivityData}
                >
                  📊 View Activity Data
                </button>
              ) : (
                <div className="action-button" style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  borderColor: 'rgba(245, 158, 11, 0.3)',
                  color: 'var(--warning-color)',
                  cursor: 'not-allowed',
                  opacity: 0.7
                }}>
                  📊 Connect Device First
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;