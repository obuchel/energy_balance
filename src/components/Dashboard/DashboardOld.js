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
      
      // REMOVED: Don't check registrationComplete since we bypassed it in SignIn
      // if (!parsedUserData.registrationComplete) {
      //   navigate('/register');
      //   return;
      // }
      
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
  }, [loading, userData]); // Changed dependency to userData instead of ref
  
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
      .call(d3.axisBottom(x));
      
    // Y axis scale
    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0]);
      
    svg.append("g")
      .call(d3.axisLeft(y));
      
    // Add line path for forecast
    const line = d3.line()
      .x(d => x(d.hour) + x.bandwidth() / 2)
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);
      
    svg.append("path")
      .datum(energyData)
      .attr("fill", "none")
      .attr("stroke", "#4299e1")
      .attr("stroke-width", 3)
      .attr("d", line);
      
    // Add dots
    svg.selectAll(".dot")
      .data(energyData)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", d => x(d.hour) + x.bandwidth() / 2)
      .attr("cy", d => y(d.value))
      .attr("r", 5)
      .attr("fill", d => d.actual ? "#4299e1" : "#E2E8F0")
      .attr("stroke", "#4299e1")
      .attr("stroke-width", 2);
      
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
        .attr("stroke", "#FC8181")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5");
        
      svg.append("text")
        .attr("x", posX)
        .attr("y", 10)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", "#FC8181")
        .text("Now");
    }
  };
  
  // Handle button click for tracking meal
  const handleTrackMeal = () => {
    // Navigate to FoodTrackerPage
    navigate('/food-tracker');
  };

  // Handle button click for activity dashboard
  const handleViewActivityData = () => {
    navigate('/fitbit-dashboard');
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
  
  return (
    <div className="dashboard-container">
      <div className="header">
        <h1>Energy Management Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {userData?.name || 'User'}!</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
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
          <h3 className="card-title">
            Daily Energy Forecast
            <span className="info-icon" title="Predicts how your energy levels will change throughout the day based on planned activities and historical patterns.">ⓘ</span>
          </h3>
          <div id="forecast-chart" ref={forecastChartRef} className="forecast-chart"></div>
        </div>

        <div className="card status-summary-container">
          <h3 className="card-title">
            Quick Actions
            <span className="info-icon" title="One-tap access to common activities for logging your day and managing your condition.">ⓘ</span>
          </h3>
          <div className="quick-actions">
            <button className="action-button meal" onClick={handleTrackMeal}>
              📝 Track Meal
            </button>
            {isFitbitConnected && (
              <button className="action-button activity" onClick={handleViewActivityData}>
                📊 View Activity Data
              </button>
            )}
          </div>
        </div>
        

      </div>
    </div>
  );
}

export default Dashboard;