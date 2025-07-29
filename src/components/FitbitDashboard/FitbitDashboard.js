// FitbitDashboard.js - Complete Fixed Version with Debug Tools
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../../firebase-config';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import "../Common.css";
import './FitbitDashboard.css';

// Helper function to get today's date in user's timezone
const getTodayInUserTimezone = () => {
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = new Date();
  
  // Use toLocaleDateString to get the correct local date
  const localDateString = today.toLocaleDateString('en-CA', {timeZone: userTimezone}); // en-CA gives YYYY-MM-DD format
  
  console.log('🌍 Timezone debug:', {
    userTimezone,
    utcTime: today.toISOString(),
    localDateString: localDateString
  });
  
  return localDateString;
};

// Update user timezone function
const updateUserTimezone = async (userId) => {
  try {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    await setDoc(doc(db, 'users', userId), {
      timezone: userTimezone,
      timezoneUpdatedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log('✅ User timezone saved:', userTimezone);
  } catch (error) {
    console.error('❌ Error saving user timezone:', error);
  }
};

const FitbitDashboard = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [fitbitData, setFitbitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('checking');
  const [timeseriesData, setTimeseriesData] = useState([]);
  const [selectedDateMetrics, setSelectedDateMetrics] = useState(null);
  
  // Initialize with correct local date
  const [selectedDate, setSelectedDate] = useState(() => getTodayInUserTimezone());
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  const API_BASE_URL = 'https://6zfuwxqp01.execute-api.us-east-1.amazonaws.com/dev';

  // DEBUG FUNCTIONS - Must be defined before they're used
  // Wrap debugState in useCallback for stable reference
  const debugState = useCallback(() => {
    console.log('🐛 DEBUG STATE:', {
      user: user?.uid || 'No user',
      status: status,
      connecting: connecting,
      error: error,
      userData: userData ? 'User data exists' : 'No user data',
      fitbitData: fitbitData ? 'Fitbit data exists' : 'No fitbit data',
      clientId: process.env.REACT_APP_FITBIT_CLIENT_ID ? 'Present' : 'Missing'
    });
  }, [user, status, connecting, error, userData, fitbitData]);



  // Diagnostic tool component - MUST be defined before ConnectionError uses it
  // Simplified diagnostic tool - just shows essential info
  const DiagnosticTool = () => {
    const diagnostics = {
      user: user?.uid || 'No user',
      status: status,
      connecting: connecting,
      error: error || 'None',
      clientId: process.env.REACT_APP_FITBIT_CLIENT_ID ? 'Present' : 'Missing',
      functions: `onReconnect=${typeof startFitbitConnection}, onForceReconnect=${typeof forceResetConnection}`
    };
    
    return (
      <div style={{ 
        background: '#f8f9fa', 
        padding: '1rem', 
        margin: '1rem 0', 
        border: '2px solid #007bff',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '0.9rem'
      }}>
        <h3 style={{ color: '#007bff', margin: '0 0 1rem 0' }}>🐛 Debug Info:</h3>
        
        <div style={{ 
          background: 'white', 
          padding: '1rem', 
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          fontSize: '0.8rem'
        }}>
          {Object.entries(diagnostics).map(([key, value]) => (
            <div key={key} style={{ marginBottom: '0.5rem' }}>
              <strong>{key}:</strong> {value}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Debug monitoring useEffect (separate from functions)
  useEffect(() => {
    debugState();
  }, [debugState]);

  // Enhanced startFitbitConnection function with debugging
  // Replace your startFitbitConnection function with this enhanced version:

const startFitbitConnection = () => {
  console.log('🚀 startFitbitConnection called');
  console.log('🚀 Current state:', { 
    user: user?.uid, 
    connecting, 
    status,
    error: error || 'none'
  });
  
  if (!user?.uid) {
    console.error('❌ No user authenticated');
    setError('User not authenticated');
    return;
  }

  console.log('🚀 Setting connecting to true');
  setConnecting(true);
  setError('');

  const clientId = process.env.REACT_APP_FITBIT_CLIENT_ID;
  console.log('🚀 Client ID check:', clientId ? 'Present' : 'Missing');
  
  if (!clientId) {
    console.error('❌ No client ID found');
    setError('Fitbit Client ID not configured. Please check environment variables.');
    setConnecting(false);
    return;
  }

  try {
    // Clear any existing session data first
    sessionStorage.removeItem('fitbitOAuthState');
    sessionStorage.removeItem('fitbitAuthStartTime');
    
    // Generate a new state with timestamp for uniqueness
    const timestamp = Date.now().toString();
    const randomPart = Math.random().toString(36).substring(2, 15);
    const state = `${timestamp}_${randomPart}_${user.uid.substring(0, 8)}`;
    
    console.log('🚀 Generated OAuth state:', state);
    
    // Store state and timestamp with verification
    sessionStorage.setItem('fitbitOAuthState', state);
    sessionStorage.setItem('fitbitAuthStartTime', timestamp);
    
    // Verify storage worked
    const storedState = sessionStorage.getItem('fitbitOAuthState');
    const storedTimestamp = sessionStorage.getItem('fitbitAuthStartTime');
    
    console.log('🚀 Storage verification:', {
      stateStored: storedState === state,
      timestampStored: storedTimestamp === timestamp,
      storedState: storedState,
      storedTimestamp: storedTimestamp
    });
    
    if (storedState !== state || storedTimestamp !== timestamp) {
      console.error('❌ Failed to store OAuth state properly');
      setError('Failed to initialize OAuth flow. Please try again.');
      setConnecting(false);
      return;
    }

    const redirectUri = window.location.origin + window.location.pathname;
    const scope = 'activity heartrate sleep weight profile';

    const authUrl = `https://www.fitbit.com/oauth2/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${encodeURIComponent(state)}`;

    console.log('🚀 Auth URL generated:', authUrl);
    console.log('🚀 Redirect URI:', redirectUri);
    console.log('🚀 State in URL:', encodeURIComponent(state));
    
    // Add a small delay to ensure state is stored and verified
    setTimeout(() => {
      console.log('🚀 Final state check before redirect...');
      const finalStateCheck = sessionStorage.getItem('fitbitOAuthState');
      if (finalStateCheck === state) {
        console.log('🚀 Redirecting to Fitbit...');
        window.location.href = authUrl;
      } else {
        console.error('❌ State lost before redirect');
        setError('OAuth state was lost. Please try again.');
        setConnecting(false);
      }
    }, 200);
    
  } catch (error) {
    console.error('❌ Error in startFitbitConnection:', error);
    setError('Failed to start OAuth flow. Please try again.');
    setConnecting(false);
  }
};

  // Force reset function for OAuth issues
  const forceResetConnection = useCallback(async () => {
    console.log('🧹 FORCE RESET: Clearing all OAuth state and data');
    
    try {
      // Clear all session storage
      const sessionKeys = ['fitbitOAuthState', 'fitbitAuthStartTime'];
      sessionKeys.forEach(key => {
        const value = sessionStorage.getItem(key);
        console.log(`🧹 Clearing ${key}:`, value);
        sessionStorage.removeItem(key);
      });
      
      // Clear URL parameters
      const cleanUrl = window.location.pathname;
      console.log('🧹 Cleaning URL from:', window.location.href, 'to:', cleanUrl);
      window.history.replaceState({}, document.title, cleanUrl);
      
      // Update Firestore to clear Fitbit connection
      if (user?.uid) {
        console.log('🧹 Updating Firestore to clear Fitbit connection...');
        await setDoc(doc(db, 'users', user.uid), {
          deviceConnected: false,
          selectedDevice: null,
          fitbitData: null,
          lastUpdated: new Date().toISOString()
        }, { merge: true });
        console.log('✅ Firestore updated successfully');
      }
      
      // Reset component state
      setError('');
      setConnecting(false);
      setStatus('needs_connection');
      setFitbitData(null);
      setTimeseriesData([]);
      setSelectedDateMetrics(null);
      
      // Clear user data fitbit connection
      if (userData) {
        setUserData(prev => ({
          ...prev,
          deviceConnected: false,
          selectedDevice: null,
          fitbitData: null
        }));
      }
      
      // Update localStorage
      const storedUserData = localStorage.getItem('userData');
      if (storedUserData) {
        const parsedData = JSON.parse(storedUserData);
        const updatedData = {
          ...parsedData,
          deviceConnected: false,
          selectedDevice: null,
          fitbitData: null
        };
        localStorage.setItem('userData', JSON.stringify(updatedData));
        console.log('✅ localStorage updated');
      }
      
      console.log('✅ Force reset completed - ready for fresh connection');
      
    } catch (error) {
      console.error('❌ Error during force reset:', error);
      setError('Failed to reset connection. Please try again.');
    }
  }, [user?.uid, userData]);

  // Enhanced token validation and refresh
  const validateAndRefreshToken = useCallback(async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();
      const tokenData = userData?.fitbitData;
      
      if (!tokenData?.accessToken) {
        console.log('❌ No access token found');
        setStatus('needs_connection');
        setError('Please connect your Fitbit account to continue.');
        return null;
      }
      
      // Check if token will expire in the next 30 minutes
      const tokenExpiresAt = tokenData.tokenExpiresAt;
      const willExpireSoon = tokenExpiresAt && 
        (new Date(tokenExpiresAt).getTime() - Date.now()) < (30 * 60 * 1000);
      
      if (willExpireSoon && tokenData.refreshToken) {
        console.log('🔄 Token expiring soon, refreshing...');
        
        try {
          const newTokenData = await refreshFitbitToken(tokenData.refreshToken);
          
          // Save new tokens
          await setDoc(doc(db, 'users', userId), {
            fitbitData: {
              ...tokenData,
              accessToken: newTokenData.accessToken,
              refreshToken: newTokenData.refreshToken,
              tokenExpiresAt: newTokenData.tokenExpiresAt,
            }
          }, { merge: true });
          
          // Update local state
          setUserData(prev => ({
            ...prev,
            fitbitData: {
              ...prev.fitbitData,
              accessToken: newTokenData.accessToken,
              refreshToken: newTokenData.refreshToken,
              tokenExpiresAt: newTokenData.tokenExpiresAt,
            }
          }));
          
          console.log('✅ Token refreshed successfully');
          return newTokenData.accessToken;
          
        } catch (refreshError) {
          console.error('❌ Token refresh failed:', refreshError);
          setError('Your Fitbit connection has expired. Please reconnect your account.');
          setStatus('needs_connection');
          return null;
        }
      }
      
      return tokenData.accessToken;
      
    } catch (error) {
      console.error('❌ Error validating token:', error);
      setStatus('needs_connection');
      setError('Unable to validate your Fitbit connection. Please reconnect.');
      return null;
    }
  }, []);

  // Enhanced timezone-aware fetchTimeseriesData
  const fetchTimeseriesData = useCallback(async (date, userId) => {
    if (!userId) return;
    
    try {
      setTimeseriesLoading(true);
      console.log('📊 Fetching timeseries data for date:', date);
      
      // Get user's stored timezone preference, fallback to browser detection
      let userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists() && userDoc.data().timezone) {
          userTimezone = userDoc.data().timezone;
          console.log('✅ Using stored user timezone:', userTimezone);
        } else {
          console.log('⚠️ No stored timezone, using browser detection:', userTimezone);
          await updateUserTimezone(userId);
        }
      } catch (timezoneError) {
        console.warn('⚠️ Could not fetch user timezone, using browser default:', timezoneError);
      }
      
      // Create date range that spans potential timezone boundaries
      const selectedDate = new Date(date + 'T00:00:00');
      
      // Generate date strings for timezone overlap (previous, current, next day)
      const dateStrings = [];
      for (let dayOffset = -1; dayOffset <= 1; dayOffset++) {
        const checkDate = new Date(selectedDate);
        checkDate.setDate(checkDate.getDate() + dayOffset);
        const dateString = checkDate.toISOString().slice(0, 10).replace(/-/g, '');
        dateStrings.push(dateString);
      }
      
      console.log('🔍 Searching date strings for', userTimezone, ':', dateStrings);
      
      const timeseriesRef = collection(db, 'fitbit_timeseries');
      const querySnapshot = await getDocs(timeseriesRef);
      const data = [];
      
      querySnapshot.forEach((docSnapshot) => {
        const docId = docSnapshot.id;
        const docData = docSnapshot.data();
        
        // Check if document matches any of our date patterns
        const matchesAnyDate = dateStrings.some(dateStr => 
          docId.startsWith(`${userId}_${dateStr}_`)
        );
        
        if (matchesAnyDate) {
          console.log('📊 Found matching document:', docId);
          
          // Extract calories and other metrics
          let calories = 0;
          let steps = 0;
          let distance = 0;
          let activeMinutes = 0;
          
          if (docData.metrics) {
            calories = docData.metrics.calories || 0;
            steps = docData.metrics.steps || 0;
            distance = docData.metrics.distance || 0;
            activeMinutes = docData.metrics.activeMinutes || 0;
          } else {
            calories = docData.calories || 0;
            steps = docData.steps || 0;
            distance = docData.distance || 0;
            activeMinutes = docData.activeMinutes || 0;
          }
          
          // Parse timestamp
          let actualTimestamp = null;
          
          if (docData.timestamp || docData.syncedAt) {
            actualTimestamp = new Date(docData.timestamp || docData.syncedAt);
          } else {
            // Reconstruct from document ID
            const parts = docId.split('_');
            if (parts.length >= 3) {
              const datePart = parts[1];
              const timePart = parts[2];
              
              if (datePart.length === 8 && timePart.length >= 6) {
                const year = datePart.substring(0, 4);
                const month = datePart.substring(4, 6);
                const day = datePart.substring(6, 8);
                const hours = timePart.substring(0, 2);
                const minutes = timePart.substring(2, 4);
                const seconds = timePart.substring(4, 6);
                
                actualTimestamp = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`);
              }
            }
          }
          
          if (actualTimestamp) {
            // Convert UTC to user's timezone
            const userLocalTime = new Date(actualTimestamp.toLocaleString("en-US", {timeZone: userTimezone}));
            
            // Check if this data point belongs to the selected date in user's timezone
            const pointDateLocal = userLocalTime.toDateString();
            const targetDateLocal = selectedDate.toDateString();
            
            console.log('🌍 Timezone conversion:', {
              docId: docId,
              utcTime: actualTimestamp.toISOString(),
              userLocalTime: userLocalTime.toISOString(),
              pointDate: pointDateLocal,
              targetDate: targetDateLocal,
              matches: pointDateLocal === targetDateLocal,
              userTimezone: userTimezone
            });
            
            if (pointDateLocal === targetDateLocal) {
              // Display in user's timezone
              const displayTime = actualTimestamp.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: userTimezone
              });
              
              const sortableTime = userLocalTime.getTime();
              
              data.push({
                time: displayTime,
                calories: calories,
                steps: steps,
                distance: distance,
                activeMinutes: activeMinutes,
                timestamp: actualTimestamp.toISOString(),
                sortableTime: sortableTime,
                docId: docId,
                actualTimestamp: actualTimestamp,
                userLocalTime: userLocalTime,
                userTimezone: userTimezone
              });
            }
          }
        }
      });
      
      // Sort by user's local time
      data.sort((a, b) => a.sortableTime - b.sortableTime);
      
      // Calculate daily totals for the selected date
      const dailyTotals = {
        steps: 0,
        calories: 0,
        distance: 0,
        activeMinutes: 0,
        dataPoints: data.length
      };

      // Since Fitbit data is cumulative, take the HIGHEST value (end of day total)
      data.forEach(point => {
        dailyTotals.calories = Math.max(dailyTotals.calories, point.calories || 0);
        dailyTotals.steps = Math.max(dailyTotals.steps, point.steps || 0);
        dailyTotals.distance = Math.max(dailyTotals.distance, point.distance || 0);
        dailyTotals.activeMinutes = Math.max(dailyTotals.activeMinutes, point.activeMinutes || 0);
      });
      
      console.log(`📊 Found ${data.length} data points for ${date} (${userTimezone}):`, data);
      console.log('📊 Daily totals for selected date:', dailyTotals);
      
      setTimeseriesData(data);
      setSelectedDateMetrics(dailyTotals);
      
    } catch (err) {
      console.error('❌ Error fetching timeseries data:', err);
      setTimeseriesData([]);
      setSelectedDateMetrics(null);
    } finally {
      setTimeseriesLoading(false);
    }
  }, []);

  // Proactive token refresh
  useEffect(() => {
    const checkTokenExpiration = async () => {
      if (!user?.uid || !userData?.fitbitData?.tokenExpiresAt) return;
      
      const tokenExpiresAt = new Date(userData.fitbitData.tokenExpiresAt);
      const timeUntilExpiry = tokenExpiresAt.getTime() - Date.now();
      
      // If token expires in less than 1 hour, refresh it
      if (timeUntilExpiry < (60 * 60 * 1000) && timeUntilExpiry > 0) {
        console.log('🔄 Token expiring soon, refreshing proactively...');
        
        try {
          const newTokenData = await refreshFitbitToken(userData.fitbitData.refreshToken);
          
          await setDoc(doc(db, 'users', user.uid), {
            fitbitData: {
              ...userData.fitbitData,
              accessToken: newTokenData.accessToken,
              refreshToken: newTokenData.refreshToken,
              tokenExpiresAt: newTokenData.tokenExpiresAt,
            }
          }, { merge: true });
          
          setUserData(prev => ({
            ...prev,
            fitbitData: {
              ...prev.fitbitData,
              accessToken: newTokenData.accessToken,
              refreshToken: newTokenData.refreshToken,
              tokenExpiresAt: newTokenData.tokenExpiresAt,
            }
          }));
          
          console.log('✅ Token refreshed proactively');
          
        } catch (error) {
          console.error('❌ Proactive refresh failed:', error);
          // Let it fail naturally on next API call
        }
      }
    };
    
    // Check immediately and then every 30 minutes
    checkTokenExpiration();
    const interval = setInterval(checkTokenExpiration, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user?.uid, userData?.fitbitData]);

  // Auto-save user timezone on login
  useEffect(() => {
    const saveUserTimezoneOnLogin = async () => {
      if (user?.uid) {
        console.log('👤 User logged in, checking timezone...');
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          const userData = userDoc.data();
          const shouldUpdateTimezone = !userData?.timezone || 
            !userData?.timezoneUpdatedAt || 
            (new Date() - new Date(userData.timezoneUpdatedAt)) > (30 * 24 * 60 * 60 * 1000);
          
          if (shouldUpdateTimezone) {
            await updateUserTimezone(user.uid);
          } else {
            console.log('✅ User timezone already up to date:', userData.timezone);
          }
        } catch (error) {
          console.error('❌ Error checking user timezone:', error);
        }
      }
    };
    
    saveUserTimezoneOnLogin();
  }, [user]);

  // Check if data exists for a specific date
  const checkDateHasData = useCallback(async (date, userId) => {
    if (!userId) return false;
    
    try {
      const dateString = date.replace(/-/g, '');
      const timeseriesRef = collection(db, 'fitbit_timeseries');
      const querySnapshot = await getDocs(timeseriesRef);
      let hasData = false;
      
      querySnapshot.forEach((doc) => {
        if (doc.id.startsWith(`${userId}_${dateString}_`)) {
          hasData = true;
        }
      });
      
      return hasData;
    } catch (err) {
      console.error('❌ Error checking date data:', err);
      return false;
    }
  }, []);

  // Navigate to previous/next date with data
  const navigateDate = useCallback(async (direction) => {
    if (!user?.uid) return;
    
    const currentDate = new Date(selectedDate);
    let newDate = new Date(currentDate);
    
    for (let i = 1; i <= 30; i++) {
      if (direction === 'prev') {
        newDate.setDate(currentDate.getDate() - i);
      } else {
        newDate.setDate(currentDate.getDate() + i);
      }
      
      const dateString = newDate.toISOString().split('T')[0];
      const hasData = await checkDateHasData(dateString, user.uid);
      
      if (hasData) {
        setSelectedDate(dateString);
        await fetchTimeseriesData(dateString, user.uid);
        return;
      }
    }
    
    console.log('📊 No data found in the specified direction');
  }, [selectedDate, user?.uid, checkDateHasData, fetchTimeseriesData]);

  // Go to today with correct timezone
  const goToToday = useCallback(async () => {
    const todayString = getTodayInUserTimezone();
    setSelectedDate(todayString);
    if (user?.uid) {
      await fetchTimeseriesData(todayString, user.uid);
    }
  }, [user?.uid, fetchTimeseriesData]);

  // Force reconnection function
  const forceReconnection = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      console.log('🔄 Forcing Fitbit reconnection...');
      
      // Clear local state
      setUserData(prev => ({
        ...prev,
        fitbitData: null
      }));
      
      // Clear Firebase user data
      await setDoc(doc(db, 'users', user.uid), {
        fitbitData: null,
        deviceConnected: false,
        latestFitbitData: null
      }, { merge: true });
      
      // Reset status
      setStatus('needs_connection');
      setError('');
      setFitbitData(null);
      setTimeseriesData([]);
      setSelectedDateMetrics(null);
      
      console.log('✅ Forced reconnection completed');
      
    } catch (error) {
      console.error('❌ Error during forced reconnection:', error);
      setError('Failed to reset connection. Please refresh the page.');
    }
  }, [user?.uid]);

  // Fetch Fitbit data from serverless API
  const fetchFitbitDataFromAPI = async (accessToken) => {
    console.log('📡 Fetching Fitbit data from serverless API...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/fitbit`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Data received from serverless API:', data);

      return {
        heartRate: data.heartRate || null,
        steps: data.steps || 0,
        calories: data.calories || 0,
        distance: data.distance || 0,
        activeMinutes: data.activeMinutes || 0,
        sleep: data.sleep || null,
        weight: data.weight || null,
        date: data.date || new Date().toISOString().split('T')[0],
        lastSync: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Error fetching from serverless API:', error);
      throw new Error(`Failed to fetch Fitbit data: ${error.message}`);
    }
  };

  // Refresh Fitbit token
  const refreshFitbitToken = async (refreshToken) => {
    console.log('🔄 Refreshing Fitbit token...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
      }

      const tokenData = await response.json();
      console.log('✅ Token refreshed successfully');

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      };
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
      throw error;
    }
  };

  // Enhanced fetch Fitbit data function with better token management
  const fetchFitbitData = useCallback(async (accessToken, userId, refreshToken = null) => {
    try {
      console.log('🔄 Fetching fresh Fitbit data...');
      
      setLoading(true);
      setError('');

      // Validate token first
      const validToken = await validateAndRefreshToken(userId);
      if (!validToken) {
        return; // Error already set in validateAndRefreshToken
      }

      const data = await fetchFitbitDataFromAPI(validToken);

      await setDoc(doc(db, 'users', userId), {
        latestFitbitData: data,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      setFitbitData(data);
      console.log('✅ Fitbit data updated successfully');

      await fetchTimeseriesData(selectedDate, userId);

    } catch (err) {
      console.error('❌ Error fetching Fitbit data:', err);

      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        setError('Your Fitbit connection has expired. Please reconnect your account.');
        setStatus('needs_connection');
      } else {
        setError(`Failed to fetch Fitbit data: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [validateAndRefreshToken, selectedDate, fetchTimeseriesData]);

  // Load user data from Firestore
  const loadUserData = useCallback(async (userId) => {
    try {
      setLoading(true);
      console.log('📊 Loading user data for userId:', userId);
      
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        console.log('✅ User data loaded:', data.email);
        
        setUserData(data);
        
        if (data.fitbitData?.accessToken) {
          setStatus('connected');
          
          if (data.latestFitbitData) {
            setFitbitData(data.latestFitbitData);
          }
          
          await fetchTimeseriesData(selectedDate, userId);
        } else {
          setStatus('needs_connection');
        }
      } else {
        setError('User profile not found. Please contact support.');
        setStatus('error');
      }
    } catch (err) {
      console.error('❌ Error loading user data:', err);
      setError(`Failed to load user data: ${err.message}`);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }, [fetchTimeseriesData, selectedDate]);

  // Secure token exchange
  const exchangeCodeForTokens = async (authCode) => {
    console.log('🔧 Starting secure token exchange...');
    const redirectUri = window.location.origin + window.location.pathname;

    try {
      const response = await fetch(`${API_BASE_URL}/token-exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: authCode,
          redirect_uri: redirectUri
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
      }

      const tokenData = await response.json();
      console.log('✅ Token exchange successful');
      return tokenData;
    } catch (fetchError) {
      console.error('❌ Error during token exchange:', fetchError);
      throw new Error(`Token exchange failed: ${fetchError.message}`);
    }
  };

  // Process Fitbit OAuth callback
  const processFitbitOAuth = useCallback(async (code, state) => {
    try {
      setConnecting(true);
      setError('');

      const storedState = sessionStorage.getItem('fitbitOAuthState');
      const storedTimestamp = sessionStorage.getItem('fitbitAuthStartTime');
      
      console.log('🔍 OAuth State Validation:', {
        receivedState: state,
        storedState: storedState,
        storedTimestamp: storedTimestamp,
        stateMatch: state === storedState,
        hasCode: !!code
      });

      // Enhanced state validation with better error handling
      if (!storedState) {
        console.warn('⚠️ No stored OAuth state found - this might be a page refresh');
        // Continue with the flow but log the issue
      } else if (state !== storedState) {
        console.error('❌ State mismatch detected');
        console.error('Expected:', storedState);
        console.error('Received:', state);
        
        // Check if this is a recent auth attempt (within 5 minutes)
        const authStartTime = parseInt(storedTimestamp || '0');
        const timeDiff = Date.now() - authStartTime;
        const isRecent = timeDiff < 5 * 60 * 1000; // 5 minutes
        
        if (isRecent && code) {
          console.log('🔄 Recent auth attempt detected, proceeding with caution...');
          // Continue with the flow but log the security concern
        } else {
          throw new Error('Security validation failed. Please try again.');
        }
      }

      console.log('🔄 Processing OAuth callback...');

      const tokenData = await exchangeCodeForTokens(code);

      const fitbitData = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
        connectedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', user.uid), {
        fitbitData,
        deviceConnected: true,
        selectedDevice: 'fitbit',
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      setUserData(prev => ({ ...prev, fitbitData }));
      setStatus('connected');

      // Clean up session storage
      sessionStorage.removeItem('fitbitOAuthState');
      sessionStorage.removeItem('fitbitAuthStartTime');
      window.history.replaceState({}, document.title, window.location.pathname);

      console.log('✅ Fitbit connection completed');

      await fetchFitbitData(tokenData.access_token, user.uid, tokenData.refresh_token);
    } catch (err) {
      console.error('❌ Error processing OAuth:', err);
      setError(`Failed to connect Fitbit: ${err.message}`);
      setStatus('error');
      
      // Clean up on error
      sessionStorage.removeItem('fitbitOAuthState');
      sessionStorage.removeItem('fitbitAuthStartTime');
    } finally {
      setConnecting(false);
    }
  }, [user, fetchFitbitData]);

  // Logout function
  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('userData');
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      localStorage.removeItem('userData');
      navigate('/login');
      setError('Failed to logout. Please try again.');
    }
  };

  // Navigation functions
  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  // Refresh data
  const refreshData = useCallback(() => {
    if (userData?.fitbitData?.accessToken && user?.uid) {
      fetchFitbitData(
        userData.fitbitData.accessToken, 
        user.uid, 
        userData.fitbitData.refreshToken
      );
      fetchTimeseriesData(selectedDate, user.uid);
    }
  }, [userData?.fitbitData?.accessToken, userData?.fitbitData?.refreshToken, user?.uid, fetchFitbitData, selectedDate, fetchTimeseriesData]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        console.log('✅ User authenticated with UID:', currentUser.uid);
        setUser(currentUser);
        await loadUserData(currentUser.uid);
      } else {
        console.log('❌ No authenticated user, redirecting to login');
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate, loadUserData]);

  // Check for OAuth callback parameters
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      if (code && state && user) {
        console.log('🔄 Processing OAuth callback...');
        await processFitbitOAuth(code, state);
      } else if (error) {
        setError(`Fitbit authorization failed: ${error}`);
        setStatus('error');
        setConnecting(false);
      }
    };

    if (user && location.search) {
      handleOAuthCallback();
    }
  }, [user, location.search, processFitbitOAuth]);

  // Enhanced Connection Error Component with better click handling
  const ConnectionError = ({ error, onReconnect, onForceReconnect }) => {
    console.log('🔧 ConnectionError rendered with:', { 
      error, 
      onReconnect: !!onReconnect, 
      onForceReconnect: !!onForceReconnect,
      connecting 
    });
    
    return (
      <div className="dashboard-card connection-error-card" style={{ position: 'relative', zIndex: 100 }}>
        <div className="card-glow" style={{ pointerEvents: 'none' }}></div>
        <div className="card-content-wrapper">
          <div className="error-icon">⚠️</div>
          <h2 className="error-title">Connection Issue</h2>
          <p className="error-description">
            {error.includes('expired') 
              ? 'Your Fitbit connection has expired for security reasons. This is normal and happens every few hours.'
              : error
            }
          </p>
          
          {/* Add debug panel */}
          <DiagnosticTool />
          
          <div className="error-actions" style={{ 
            position: 'relative', 
            zIndex: 200, 
            pointerEvents: 'auto',
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            margin: '1.5rem 0'
          }}>
            <button
              onClick={(e) => {
                console.log('🔗 Reconnect button clicked', e);
                e.preventDefault();
                e.stopPropagation();
                
                if (onReconnect && typeof onReconnect === 'function') {
                  console.log('🔗 Calling onReconnect...');
                  onReconnect();
                } else {
                  console.error('❌ No onReconnect function provided');
                  alert('onReconnect function is missing! Check console.');
                }
              }}
              className="reconnect-button primary"
              disabled={connecting}
              style={{ 
                cursor: 'pointer', 
                pointerEvents: 'auto',
                position: 'relative',
                zIndex: 300,
                background: connecting ? '#6c757d' : '#28a745',
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {connecting ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Connecting...
                </>
              ) : (
                <>🔗 Reconnect Fitbit</>
              )}
            </button>
            
            <button
              onClick={async (e) => {
                console.log('🔄 Force Reset button clicked', e);
                e.preventDefault();
                e.stopPropagation();
                
                if (onForceReconnect && typeof onForceReconnect === 'function') {
                  console.log('🔄 Calling onForceReconnect...');
                  try {
                    setConnecting(true);
                    await onForceReconnect();
                    console.log('✅ Force reset completed successfully');
                  } catch (error) {
                    console.error('❌ Force reset failed:', error);
                    setError('Force reset failed. Please try again.');
                  } finally {
                    setConnecting(false);
                  }
                } else {
                  console.error('❌ No onForceReconnect function provided');
                  alert('onForceReconnect function is missing! Check console.');
                }
              }}
              className="force-reconnect-button secondary"
              disabled={connecting}
              style={{ 
                cursor: connecting ? 'not-allowed' : 'pointer', 
                pointerEvents: 'auto',
                position: 'relative',
                zIndex: 300,
                background: connecting ? '#6c757d' : '#dc3545',
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {connecting ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Resetting...
                </>
              ) : (
                <>🔄 Force Reset</>
              )}
            </button>
          </div>
          
          <div className="help-text">
            <strong>Why did this happen?</strong><br/>
            Fitbit tokens expire every 8 hours for security. Simply reconnect to continue.
            <br/><br/>
            <strong>Still having issues?</strong><br/>
            Try "Force Reset" to completely clear your connection and start fresh.
          </div>
          
          {/* Debug info */}
          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: '#f0f0f0', 
            fontSize: '0.8rem',
            borderRadius: '4px',
            fontFamily: 'monospace'
          }}>
            <strong>🐛 Debug Info:</strong><br/>
            User: {user?.uid || 'None'}<br/>
            Status: {status}<br/>
            Connecting: {connecting.toString()}<br/>
            Error: {error}<br/>
            Client ID: {process.env.REACT_APP_FITBIT_CLIENT_ID ? 'Present' : 'Missing'}<br/>
            Functions: onReconnect={typeof onReconnect}, onForceReconnect={typeof onForceReconnect}
          </div>
        </div>
      </div>
    );
  };

  // Timeseries Chart Component
  const TimeseriesChart = () => (
    <div className="dashboard-card enhanced-card">
      <div className="chart-header">
        <h3>🔥 Calories Timeline</h3>
        
        <div className="chart-controls">
          <button
            onClick={() => navigateDate('prev')}
            disabled={timeseriesLoading}
            className="nav-button"
          >
            ← Previous
          </button>
          
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              if (user?.uid) {
                fetchTimeseriesData(e.target.value, user.uid);
              }
            }}
            className="date-input"
          />
          
          <button
            onClick={() => navigateDate('next')}
            disabled={timeseriesLoading || selectedDate >= getTodayInUserTimezone()}
            className="nav-button"
          >
            Next →
          </button>
          
          {selectedDate !== getTodayInUserTimezone() && (
            <button
              onClick={goToToday}
              disabled={timeseriesLoading}
              className="today-button"
            >
              📅 Today
            </button>
          )}
          
          <button
            onClick={() => {
              console.log('🐛 DEBUG: Manual fetch triggered');
              console.log('🐛 Current user UID:', user?.uid);
              console.log('🐛 Selected date:', selectedDate);
              if (user?.uid) {
                fetchTimeseriesData(selectedDate, user.uid);
              }
            }}
            disabled={timeseriesLoading || !user?.uid}
            className="debug-button"
          >
            🐛 Debug Fetch
          </button>
        </div>
      </div>
      
      {timeseriesLoading ? (
        <div className="loading-container">
          <div className="loading-spinner-large"></div>
        </div>
      ) : timeseriesData.length > 0 ? (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeseriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="time" 
                stroke="#666"
                fontSize={12}
                interval="preserveStartEnd"
              />
              <YAxis 
                stroke="#666"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
                formatter={(value) => [value, 'Calories']}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="calories" 
                stroke="#dc3545" 
                strokeWidth={2}
                dot={{ fill: '#dc3545', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#dc3545', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="no-data-container">
          <div className="no-data-icon">📊</div>
          <p className="no-data-title">
            No calorie data available for {selectedDate}
          </p>
          <p className="no-data-subtitle">
            {selectedDate === getTodayInUserTimezone() 
              ? 'Click "🐛 Debug Fetch" to check data loading'
              : 'Use the navigation buttons to find dates with data'
            }
          </p>
          {user?.uid && (
            <div className="debug-info-box">
              <strong>🐛 Debug Info:</strong><br />
              User UID: {user.uid}<br />
              Looking for documents starting with: {user.uid}_{selectedDate.replace(/-/g, '')}_<br />
              (e.g., {user.uid}_{selectedDate.replace(/-/g, '')}_190044)
            </div>
          )}
        </div>
      )}
      
      {timeseriesData.length > 0 && (
        <div className="chart-summary">
          <strong>📈 Summary for {selectedDate}:</strong><br />
          Data points: {selectedDateMetrics?.dataPoints || 0} | 
          Total Calories: {selectedDateMetrics?.calories?.toLocaleString() || 0} cal | 
          Peak: {Math.max(...timeseriesData.map(d => d.calories)).toLocaleString()} cal | 
          Latest: {timeseriesData[timeseriesData.length - 1]?.calories.toLocaleString()} cal
        </div>
      )}
    </div>
  );

  // Metric Card Component
  const MetricCard = ({ title, value, unit, icon, color = '#3b82f6' }) => (
    <div className="metric-card" style={{ borderColor: color }}>
      <div className="metric-icon">{icon}</div>
      <h3 className="metric-title" style={{ color: color }}>{title}</h3>
      <div className="metric-value">{value}</div>
      <div className="metric-unit">{unit}</div>
    </div>
  );

  // Error Display Component
  const ErrorDisplay = ({ error, onRetry }) => (
    <div className="error-display">
      <div className="error-content">
        <div>
          <strong>⚠️ Error:</strong>
          <div className="error-message">{error}</div>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="retry-button"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );

  if (loading && status === 'checking') {
    return (
      <div className="dashboard-container checking">
        <div className="bg-animation">
          <div className="floating-shape shape-1"></div>
          <div className="floating-shape shape-2"></div>
          <div className="floating-shape shape-3"></div>
        </div>

        <div className="loading-center">
          <div className="loading-spinner-large"></div>
          <h2 className="loading-text">Loading your dashboard...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="bg-animation">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
      </div>

      <div className="dashboard-content">
        
        {/* Navigation Header */}
        <div className="navigation-header">
          <button
            onClick={handleBackToDashboard}
            className="back-button"
          >
            ← Back to Dashboard
          </button>
          
          <button
            onClick={handleLogout}
            className="logout-button"
          >
            Logout
          </button>
        </div>
        
        {/* Header */}
        <div className="dashboard-card main-header">
          <div className="card-glow"></div>
          <div className="card-content-wrapper">
            <h1 className="dashboard-title">
              <span className="title-icon">⌚</span>
              Fitbit Dashboard
            </h1>
            <p className="dashboard-subtitle">
              Welcome back, {user?.email}! Here's your fitness data.
            </p>
            
            <div className="header-controls">
              {fitbitData?.lastSync && (
                <div className="last-sync-info">
                  <strong>📊 Last Updated:</strong> {new Date(fitbitData.lastSync).toLocaleString()}
                </div>
              )}
              
              <button
                onClick={refreshData}
                disabled={loading}
                className="refresh-button"
              >
                {loading ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    Updating...
                  </>
                ) : (
                  <>🔄 Refresh All Data</>
                )}
              </button>

              {/* Force Reconnect Button for Testing */}
              {status === 'connected' && (
                <button
                  onClick={forceReconnection}
                  className="force-reconnect-button-header"
                  title="Reset Fitbit connection (for testing)"
                >
                  🔧 Force Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Error Display */}
        {error && status !== 'needs_connection' && (
          <ErrorDisplay 
            error={error} 
            onRetry={status === 'connected' ? refreshData : null}
          />
        )}

        {/* Enhanced Connection Status */}
        {status === 'needs_connection' && (
          <ConnectionError 
            error={error || 'Please connect your Fitbit account to continue.'} 
            onReconnect={startFitbitConnection}
            onForceReconnect={forceResetConnection}
          />
        )}

        {/* Connection in Progress */}
        {connecting && (
          <div className="dashboard-card connecting-card">
            <div className="card-glow"></div>
            <div className="card-content-wrapper">
              <div className="loading-spinner-large"></div>
              <h2>Connecting to Fitbit...</h2>
              <p>Please complete the authorization in the popup window.</p>
            </div>
          </div>
        )}

        {/* Connected Dashboard */}
        {status === 'connected' && !connecting && (
          <>
            {/* Timeseries Chart */}
            <TimeseriesChart />
            
            {/* Metrics Grid - Shows selected date data */}
            <div className="metrics-grid">
              <MetricCard
                title={`Steps (${selectedDate})`}
                value={selectedDateMetrics?.steps?.toLocaleString() || '0'}
                unit="steps"
                icon="👟"
                color="#10b981"
              />
              
              <MetricCard
                title={`Calories (${selectedDate})`}
                value={selectedDateMetrics?.calories?.toLocaleString() || '0'}
                unit="calories"
                icon="🔥"
                color="#ef4444"
              />
              
              <MetricCard
                title={`Distance (${selectedDate})`}
                value={selectedDateMetrics?.distance ? selectedDateMetrics.distance.toFixed(2) : '0'}
                unit="km"
                icon="🏃‍♂️"
                color="#3b82f6"
              />
              
              <MetricCard
                title={`Active Minutes (${selectedDate})`}
                value={selectedDateMetrics?.activeMinutes?.toString() || '0'}
                unit="minutes"
                icon="⚡"
                color="#f59e0b"
              />
            </div>

            {/* Additional Data Cards - Only show if we have recent sync data */}
            {fitbitData && (
              <div className="additional-cards-grid">
                
                {/* Heart Rate Card */}
                {fitbitData.heartRate && (
                  <div className="dashboard-card data-card heart-rate-card">
                    <h3 className="data-card-title">
                      <span className="data-card-icon">❤️</span>
                      Heart Rate (Latest Sync)
                    </h3>
                    
                    <div className="heart-rate-grid">
                      <div className="heart-rate-stat">
                        <div className="heart-rate-value">
                          {fitbitData.heartRate.restingHeartRate || 'N/A'}
                        </div>
                        <div className="heart-rate-label">Resting BPM</div>
                      </div>
                      
                      {fitbitData.heartRate.zones && (
                        <div className="heart-rate-stat">
                          <div className="heart-rate-value">
                            {fitbitData.heartRate.zones.length}
                          </div>
                          <div className="heart-rate-label">HR Zones</div>
                        </div>
                      )}
                    </div>
                    
                    {fitbitData.heartRate.zones && fitbitData.heartRate.zones.length > 0 && (
                      <div className="heart-rate-zones">
                        <div className="zones-title">Heart Rate Zones:</div>
                        {fitbitData.heartRate.zones.map((zone, index) => (
                          <div key={index} className="zone-item">
                            <span>{zone.name}:</span>
                            <span>{zone.minutes} min</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Sleep Card */}
                {fitbitData.sleep && (
                  <div className="dashboard-card data-card sleep-card">
                    <h3 className="data-card-title">
                      <span className="data-card-icon">😴</span>
                      Sleep (Latest Sync)
                    </h3>
                    
                    <div className="sleep-grid">
                      <div className="sleep-stat">
                        <div className="sleep-value">
                          {fitbitData.sleep.totalMinutes ? 
                            Math.floor(fitbitData.sleep.totalMinutes / 60) + 'h ' + 
                            (fitbitData.sleep.totalMinutes % 60) + 'm' : 'N/A'}
                        </div>
                        <div className="sleep-label">Total Sleep</div>
                      </div>
                      
                      <div className="sleep-stat">
                        <div className="sleep-value">
                          {fitbitData.sleep.efficiency || 'N/A'}%
                        </div>
                        <div className="sleep-label">Efficiency</div>
                      </div>
                    </div>
                    
                    {fitbitData.sleep.stages && (
                      <div className="sleep-stages">
                        <div className="stages-title">Sleep Stages:</div>
                        {Object.entries(fitbitData.sleep.stages).map(([stage, minutes]) => (
                          <div key={stage} className="stage-item">
                            <span className="stage-name">{stage}:</span>
                            <span>{minutes} min</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Weight Card */}
                {fitbitData.weight && (
                  <div className="dashboard-card data-card weight-card">
                    <h3 className="data-card-title">
                      <span className="data-card-icon">⚖️</span>
                      Weight (Latest Sync)
                    </h3>
                    
                    <div className="weight-content">
                      <div className="weight-value">
                        {fitbitData.weight.weight ? fitbitData.weight.weight.toFixed(1) : 'N/A'}
                      </div>
                      <div className="weight-unit">kg</div>
                      
                      {fitbitData.weight.date && (
                        <div className="weight-date">
                          Last measured: {new Date(fitbitData.weight.date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Connection Status Info */}
            <div className="dashboard-card status-card">
              <div className="status-content">
                <div className="status-indicator connected">
                  <div className="status-dot"></div>
                  <span>Connected to Fitbit</span>
                </div>
                
                {userData?.fitbitData?.connectedAt && (
                  <div className="connection-details">
                    <strong>Connected since:</strong> {new Date(userData.fitbitData.connectedAt).toLocaleDateString()}
                  </div>
                )}
                
                {userData?.fitbitData?.tokenExpiresAt && (
                  <div className="token-expiry">
                    <strong>Token expires:</strong> {new Date(userData.fitbitData.tokenExpiresAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="dashboard-card footer-card">
          <p className="footer-text">
            🔒 Your data is securely stored and synchronized with Fitbit's official API
          </p>
          
          <div className="footer-info">
            <div>
              <strong>Status:</strong> {status === 'connected' ? '✅ Connected' : '❌ Not Connected'}
            </div>
            
            {userData?.fitbitData?.scope && (
              <div>
                <strong>Permissions:</strong> {userData.fitbitData.scope}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FitbitDashboard;