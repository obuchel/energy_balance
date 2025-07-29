import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase-config';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import "../Common.css";
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
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

  // Enhanced device connection check
  const isDeviceConnected = userData && 
                           userData.deviceConnected === true && 
                           userData.selectedDevice && 
                           userData.fitbitData?.accessToken;
  
  // Show loading state
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  // Debug logging for connection state
  console.log('=== DASHBOARD DEBUG INFO ===');
  console.log('userData:', userData);
  console.log('selectedDevice:', userData?.selectedDevice);
  console.log('deviceConnected:', userData?.deviceConnected);
  console.log('fitbitData exists:', !!userData?.fitbitData);
  console.log('fitbitData accessToken exists:', !!userData?.fitbitData?.accessToken);
  console.log('isDeviceConnected:', isDeviceConnected);
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
        <div className="card status-summary-container quick-actions-card">
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

              {isDeviceConnected && (
                <button 
                  className="action-button activity" 
                  onClick={handleViewActivityData}
                >
                  📊 View Activity Data
                </button>
              )}
            </div>

            {/* Connection Status Indicator */}
            {isDeviceConnected && (
              <div className="connection-status" style={{
                marginTop: '1rem',
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#059669'
              }}>
                <strong>Device Status:</strong> <span>✅ Activity tracker connected</span>
              </div>
            )}

            {/* Debug Panel (only show in development) */}
            {process.env.NODE_ENV === 'development' && userData && (
              <details style={{ marginTop: '1rem' }}>
                <summary style={{ 
                  color: '#6b7280', 
                  fontSize: '0.8rem', 
                  cursor: 'pointer',
                  padding: '0.5rem',
                  background: '#f9fafb',
                  borderRadius: '4px'
                }}>
                  🐛 Debug Info (Development Only)
                </summary>
                <div style={{
                  marginTop: '0.5rem',
                  padding: '1rem',
                  background: '#f3f4f6',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: '#374151'
                }}>
                  <strong>User Data:</strong><br/>
                  Selected Device: {userData?.selectedDevice || 'none'}<br/>
                  Device Connected: {userData?.deviceConnected === true ? 'true' : 'false'}<br/>
                  Fitbit Token Exists: {userData?.fitbitData?.accessToken ? 'yes' : 'no'}<br/>
                  Connection Check Result: {isDeviceConnected === true ? 'true' : 'false'}<br/>
                  <br/>
                  <strong>Raw User Data:</strong><br/>
                  <pre style={{ 
                    background: 'white', 
                    padding: '0.5rem', 
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    overflow: 'auto',
                    maxHeight: '200px'
                  }}>
                    {JSON.stringify(userData, null, 2)}
                  </pre>
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;