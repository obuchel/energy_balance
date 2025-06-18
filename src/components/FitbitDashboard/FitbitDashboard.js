// FitbitDashboard.js - Fixed timeseries data handling
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../../firebase-config';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const FitbitDashboard = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [fitbitData, setFitbitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('checking'); // checking, needs_connection, connected, error
  const [timeseriesData, setTimeseriesData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Your serverless API base URL
  const API_BASE_URL = 'https://6zfuwxqp01.execute-api.us-east-1.amazonaws.com/dev';

  // 🔥 NEW: Store timeseries data points in Firestore using correct document ID format and structure
  const storeTimeseriesData = async (userId, date, metrics) => {
    try {
      const now = new Date();
      const timeString = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS format
      const dateString = date.replace(/-/g, ''); // YYYYMMDD format
      const docId = `${userId}_${dateString}_${timeString}`;
      
      const timeseriesRef = doc(db, 'fitbit_timeseries', docId);
      
      // Match the actual structure used in your Firestore
      await setDoc(timeseriesRef, {
        userId: userId,
        date: date,
        metrics: {
          calories: metrics.calories || 0,
          steps: metrics.steps || 0,
          distance: metrics.distance || 0,
          activeMinutes: metrics.activeMinutes || 0
        },
        heartRate: metrics.heartRate || null,
        sleep: metrics.sleep || null,
        timestamp: now.toISOString(),
        syncedAt: now.toISOString(),
        createdAt: now.toISOString(),
        dataSource: "fitbit_api"
      });
      
      console.log('✅ Timeseries data point stored with ID:', docId);
    } catch (error) {
      console.error('❌ Error storing timeseries data:', error);
    }
  };

  // Note: generateSampleTimeseriesData function removed since we're working with real data

  // Fetch timeseries data from Firestore using document ID pattern
  const fetchTimeseriesData = useCallback(async (date, userId) => {
    if (!userId) return;
    
    try {
      setTimeseriesLoading(true);
      console.log('📊 Fetching timeseries data for date:', date);
      
      const dateString = date.replace(/-/g, ''); // Convert 2025-06-18 to 20250618
      const timeseriesRef = collection(db, 'fitbit_timeseries');
      
      // Get all documents and filter by document ID pattern
      const querySnapshot = await getDocs(timeseriesRef);
      const data = [];
      
      querySnapshot.forEach((docSnapshot) => {
        const docId = docSnapshot.id;
        const docData = docSnapshot.data();
        
        // Check if document ID matches our pattern: userId_date_time
        if (docId.startsWith(`${userId}_${dateString}_`)) {
          console.log('📊 Found matching document:', docId, docData);
          
          // Extract calories from the actual data structure
          let calories = 0;
          if (docData.metrics && docData.metrics.calories !== undefined) {
            calories = docData.metrics.calories;
          } else if (docData.calories !== undefined) {
            calories = docData.calories;
          }
          
          // 🔥 FIX: Use actual timestamp and convert to local time
          let displayTime = '';
          let sortableTime = '';
          
          if (docData.timestamp || docData.syncedAt) {
            const timestamp = new Date(docData.timestamp || docData.syncedAt);
            // Convert to local time for display
            displayTime = timestamp.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            });
            sortableTime = timestamp.getTime(); // For sorting
          } else {
            // Fallback: extract from document ID but note it's UTC
            const timePart = docId.split('_')[2];
            if (timePart && timePart.length === 6) {
              const hours = timePart.substring(0, 2);
              const minutes = timePart.substring(2, 4);
              displayTime = `${hours}:${minutes} (UTC)`;
              sortableTime = parseInt(hours) * 60 + parseInt(minutes); // For sorting
            }
          }
          
          data.push({
            time: displayTime,
            calories: calories,
            timestamp: docData.timestamp || docData.syncedAt || new Date().toISOString(),
            sortableTime: sortableTime,
            docId: docId
          });
        }
      });
      
      // Sort by actual time (not string comparison)
      data.sort((a, b) => {
        if (typeof a.sortableTime === 'number' && typeof b.sortableTime === 'number') {
          return a.sortableTime - b.sortableTime;
        }
        return a.time.localeCompare(b.time);
      });
      
      console.log(`📊 Found ${data.length} data points for ${date}:`, data);
      setTimeseriesData(data);
      
      // Note: Working with real data only, no sample data generation
      
    } catch (err) {
      console.error('❌ Error fetching timeseries data:', err);
      setTimeseriesData([]);
    } finally {
      setTimeseriesLoading(false);
    }
  }, []);

  // Check if data exists for a specific date using document ID pattern
  const checkDateHasData = useCallback(async (date, userId) => {
    if (!userId) return false;
    
    try {
      const dateString = date.replace(/-/g, ''); // Convert 2025-06-18 to 20250618
      const timeseriesRef = collection(db, 'fitbit_timeseries');
      
      // Get all documents and check if any match our pattern
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
    
    // Look for data in the specified direction (up to 30 days)
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

  // 🔥 NEW: Button to go directly to today
  const goToToday = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    if (user?.uid) {
      await fetchTimeseriesData(today, user.uid);
    }
  }, [user?.uid, fetchTimeseriesData]);

  // Fetch Fitbit data from your serverless API
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

  // Refresh Fitbit token using your serverless API
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

  // Fetch Fitbit data with automatic token refresh
  const fetchFitbitData = useCallback(async (accessToken, userId, refreshToken = null) => {
    try {
      console.log('🔄 Fetching fresh Fitbit data...');
      setLoading(true);
      setError('');
      
      // Check if token is expired
      const tokenData = userData?.fitbitData;
      const tokenExpired = tokenData?.tokenExpiresAt && new Date() > new Date(tokenData.tokenExpiresAt);
      
      let currentAccessToken = accessToken;
      
      // Refresh token if expired
      if (tokenExpired && refreshToken) {
        try {
          console.log('🔄 Token expired, refreshing...');
          const newTokenData = await refreshFitbitToken(refreshToken);
          
          // Update Firestore with new tokens
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
          
          currentAccessToken = newTokenData.accessToken;
          console.log('✅ Token refreshed and saved');
          
        } catch (refreshError) {
          console.error('❌ Token refresh failed:', refreshError);
          setError('Your Fitbit connection has expired. Please reconnect your account.');
          setStatus('needs_connection');
          return;
        }
      }
      
      // Fetch data using current/refreshed token
      const data = await fetchFitbitDataFromAPI(currentAccessToken);
      
      // 🐛 ADD DEBUG LOGGING:
      console.log('📊 Raw API Response:', data);
      console.log('📊 Data types:', {
        steps: typeof data.steps,
        calories: typeof data.calories,
        distance: typeof data.distance,
        activeMinutes: typeof data.activeMinutes
      });
      
      // Add metadata
      const fitbitDataWithMeta = {
        ...data,
        date: new Date().toISOString().split('T')[0],
        lastSync: new Date().toISOString(),
      };
      
      // 🐛 ADD DEBUG LOGGING:
      console.log('📊 Final Data with Meta:', fitbitDataWithMeta);
      
      // Update Firestore
      await setDoc(doc(db, 'users', userId), {
        latestFitbitData: fitbitDataWithMeta,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      
      // 🔥 FIXED: Only store timeseries data if enough time has passed (avoid duplicates from refreshing)
      const today = new Date().toISOString().split('T')[0];
      
      // Check if we already have a recent data point (within last 15 minutes)
      const now = new Date();
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
      
      // Check existing timeseries data for today
      const dateString = today.replace(/-/g, '');
      const timeseriesRef = collection(db, 'fitbit_timeseries');
      const allDocs = await getDocs(timeseriesRef);
      
      let shouldStore = true;
      allDocs.forEach((docSnapshot) => {
        if (docSnapshot.id.startsWith(`${userId}_${dateString}_`)) {
          const docData = docSnapshot.data();
          if (docData.timestamp) {
            const docTime = new Date(docData.timestamp);
            if (docTime > fifteenMinutesAgo) {
              shouldStore = false; // Don't store if we have recent data
              console.log('📊 Skipping timeseries storage - recent data exists within 15 minutes');
            }
          }
        }
      });
      
      if (shouldStore) {
        await storeTimeseriesData(userId, today, fitbitDataWithMeta);
        console.log('📊 Stored new timeseries data point');
      }
      
      // Update local state
      setFitbitData(fitbitDataWithMeta);
      
      // 🔥 NEW: Refresh timeseries data if we're viewing today
      if (selectedDate === today) {
        setTimeout(() => fetchTimeseriesData(today, userId), 500);
      }
      
      console.log('✅ Fitbit data updated successfully');
      
    } catch (err) {
      console.error('❌ Error fetching Fitbit data:', err);
      
      // Handle specific error cases
      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        setError('Your Fitbit connection has expired. Please reconnect your account.');
        setStatus('needs_connection');
      } else {
        setError(`Failed to fetch Fitbit data: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [userData?.fitbitData, selectedDate, fetchTimeseriesData]);

  // Load user data from Firestore
  const loadUserData = useCallback(async (userId) => {
    try {
      setLoading(true);
      console.log('📊 Loading user data for userId:', userId);

      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        console.log('✅ User data loaded:', data.email);
        console.log('🔗 Has Fitbit tokens:', !!data.fitbitData?.accessToken);
        
        setUserData(data);
        
        if (data.fitbitData?.accessToken) {
          // User has Fitbit connected
          setStatus('connected');
          // Load existing data from Firestore if available
          if (data.latestFitbitData) {
            setFitbitData(data.latestFitbitData);
          }
          // Load timeseries data for today
          console.log('📊 About to fetch timeseries data for userId:', userId, 'and date:', selectedDate);
          await fetchTimeseriesData(selectedDate, userId);
        } else {
          // User needs to connect Fitbit
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

  // Start Fitbit OAuth connection
  const startFitbitConnection = () => {
    if (!user?.uid) {
      setError('User not authenticated');
      return;
    }

    setConnecting(true);
    setError('');
    
    // Only need client ID for frontend OAuth initiation
    const clientId = process.env.REACT_APP_FITBIT_CLIENT_ID;
    
    if (!clientId) {
      setError('Fitbit Client ID not configured. Please check environment variables.');
      setConnecting(false);
      return;
    }
    
    // Generate state for CSRF protection
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('fitbitOAuthState', state);
    sessionStorage.setItem('fitbitAuthStartTime', Date.now().toString());
    
    const redirectUri = window.location.origin + window.location.pathname;
    const scope = 'activity heartrate sleep weight profile';
    
    // Use authorization code flow (more secure than implicit)
    const authUrl = `https://www.fitbit.com/oauth2/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${state}`;
    
    console.log('🚀 Starting Fitbit OAuth flow');
    console.log('Auth URL:', authUrl);
    console.log('Redirect URI:', redirectUri);
    
    // Redirect to Fitbit
    window.location.href = authUrl;
  };

  // UPDATED: Secure token exchange through backend (no client secret on frontend)
  const exchangeCodeForTokens = async (authCode) => {
    console.log('🔧 Starting secure token exchange...');
    
    const redirectUri = window.location.origin + window.location.pathname;
    
    try {
      console.log('📡 Calling serverless token exchange endpoint...');
      
      // Only send code and redirect_uri - backend handles client credentials securely
      const response = await fetch(`${API_BASE_URL}/token-exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: authCode,
          redirect_uri: redirectUri
          // Note: No client_secret sent from frontend - backend handles this securely
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Token exchange failed:', errorText);
        throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
      }
      
      const tokenData = await response.json();
      console.log('✅ Token exchange successful via secure backend!');
      
      return tokenData;
      
    } catch (fetchError) {
      console.error('❌ Error during secure token exchange:', fetchError);
      throw new Error(`Token exchange failed: ${fetchError.message}`);
    }
  };

  // Process Fitbit OAuth callback
  const processFitbitOAuth = useCallback(async (code, state) => {
    try {
      setConnecting(true);
      setError('');
      
      // Verify state parameter
      const storedState = sessionStorage.getItem('fitbitOAuthState');
      if (state !== storedState) {
        throw new Error('Security validation failed. Please try again.');
      }

      console.log('🔄 Processing OAuth callback with secure backend...');
      
      // Exchange code for tokens using secure backend
      const tokenData = await exchangeCodeForTokens(code);
      
      console.log('✅ Token exchange successful! Saving connection...');
      
      // Save tokens to Firestore
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

      // Update local state
      setUserData(prev => ({ ...prev, fitbitData }));
      setStatus('connected');
      
      // Clean up session storage
      sessionStorage.removeItem('fitbitOAuthState');
      sessionStorage.removeItem('fitbitAuthStartTime');
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      console.log('✅ Fitbit connection completed successfully via secure backend!');
      
      // Fetch initial data
      await fetchFitbitData(tokenData.access_token, user.uid, tokenData.refresh_token);
      
    } catch (err) {
      console.error('❌ Error processing OAuth:', err);
      setError(`Failed to connect Fitbit: ${err.message}`);
      setStatus('error');
    } finally {
      setConnecting(false);
    }
  }, [user, fetchFitbitData]);

  // Logout function
  const handleLogout = async () => {
    try {
      // 1. Sign out from Firebase
      await signOut(auth);
      
      // 2. Clear localStorage (add this line)
      localStorage.removeItem('userData');
      
      // 3. Navigate to login
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      
      // Even if Firebase logout fails, clear localStorage
      localStorage.removeItem('userData');
      navigate('/login');
      
      setError('Failed to logout. Please try again.');
    }
  };

  // Navigation functions
  const handleBackToDashboard = () => {
    navigate('/dashboard'); // Adjust this path to match your main dashboard route
  };

  // Refresh data
  const refreshData = useCallback(() => {
    if (userData?.fitbitData?.accessToken && user?.uid) {
      fetchFitbitData(
        userData.fitbitData.accessToken, 
        user.uid, 
        userData.fitbitData.refreshToken
      );
      // Also refresh timeseries data
      fetchTimeseriesData(selectedDate, user.uid);
    }
  }, [userData?.fitbitData?.accessToken, userData?.fitbitData?.refreshToken, user?.uid, fetchFitbitData, selectedDate, fetchTimeseriesData]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        console.log('✅ User authenticated with UID:', currentUser.uid);
        console.log('📊 This UID should match the document IDs in fitbit_timeseries collection');
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

  // Timeseries Chart Component
  const TimeseriesChart = () => (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
      marginBottom: '24px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <h3 style={{ margin: '0', color: '#333' }}>🔥 Calories Timeline</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigateDate('prev')}
            disabled={timeseriesLoading}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: timeseriesLoading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              opacity: timeseriesLoading ? 0.6 : 1
            }}
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
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
          
          <button
            onClick={() => navigateDate('next')}
            disabled={timeseriesLoading || selectedDate >= new Date().toISOString().split('T')[0]}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: (timeseriesLoading || selectedDate >= new Date().toISOString().split('T')[0]) ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              opacity: (timeseriesLoading || selectedDate >= new Date().toISOString().split('T')[0]) ? 0.6 : 1
            }}
          >
            Next →
          </button>
          
          {/* 🔥 NEW: Today button */}
          {selectedDate !== new Date().toISOString().split('T')[0] && (
            <button
              onClick={goToToday}
              disabled={timeseriesLoading}
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '4px',
                cursor: timeseriesLoading ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                opacity: timeseriesLoading ? 0.6 : 1
              }}
            >
              📅 Today
            </button>
          )}
          
          {/* 🔥 DEBUG: Manual fetch button */}
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
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: (timeseriesLoading || !user?.uid) ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              opacity: (timeseriesLoading || !user?.uid) ? 0.6 : 1
            }}
          >
            🐛 Debug Fetch
          </button>
        </div>
      </div>
      
      {timeseriesLoading ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '300px' 
        }}>
          <div style={{
            border: '3px solid #e9ecef',
            borderTop: '3px solid #dc3545',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
      ) : timeseriesData.length > 0 ? (
        <div style={{ height: '300px' }}>
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
        <div style={{ 
          textAlign: 'center', 
          color: '#666', 
          padding: '40px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '2px dashed #dee2e6'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>📊</div>
          <p style={{ margin: '0', fontSize: '16px' }}>
            No calorie data available for {new Date(selectedDate).toLocaleDateString()}
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#999' }}>
            {selectedDate === new Date().toISOString().split('T')[0] 
              ? 'Click "🐛 Debug Fetch" to check data loading'
              : 'Use the navigation buttons to find dates with data'
            }
          </p>
          {/* 🔥 DEBUG: Show what we're looking for */}
          {user?.uid && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#e3f2fd',
              borderRadius: '6px',
              fontSize: '12px',
              textAlign: 'left'
            }}>
              <strong>🐛 Debug Info:</strong><br />
              User UID: {user.uid}<br />
              Looking for documents starting with: {user.uid}_{selectedDate.replace(/-/g, '')}_<br />
              (e.g., {user.uid}_{selectedDate.replace(/-/g, '')}_190044)
            </div>
          )}
        </div>
      )}
      
      {timeseriesData.length > 0 && (
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '6px',
          fontSize: '14px',
          color: '#666'
        }}>
          <strong>📈 Summary for {new Date(selectedDate).toLocaleDateString()}:</strong><br />
          Data points: {timeseriesData.length} | 
          Peak: {Math.max(...timeseriesData.map(d => d.calories)).toLocaleString()} cal | 
          Latest: {timeseriesData[timeseriesData.length - 1]?.calories.toLocaleString()} cal
        </div>
      )}
    </div>
  );

  // Rest of your component code remains the same...
  // (MetricCard, ErrorDisplay, loading state, OAuth handling, etc.)
  
  // Metric Card Component
  const MetricCard = ({ title, value, unit, icon, color = '#007bff' }) => (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
      border: `3px solid ${color}`,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '32px', marginBottom: '8px' }}>{icon}</div>
      <h3 style={{ color: color, margin: '0 0 8px 0', fontSize: '18px' }}>{title}</h3>
      <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
        {value}
      </div>
      <div style={{ color: '#666', fontSize: '14px' }}>{unit}</div>
    </div>
  );

  // Error Display Component
  const ErrorDisplay = ({ error, onRetry }) => (
    <div style={{
      backgroundColor: '#f8d7da',
      border: '1px solid #f5c6cb',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '24px',
      color: '#721c24'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <strong>⚠️ Error:</strong>
          <div style={{ marginTop: '8px', fontSize: '14px' }}>{error}</div>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              marginLeft: '16px'
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );

  if (loading && status === 'checking') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            border: '4px solid #e9ecef',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <h2 style={{ color: '#495057' }}>Loading your dashboard...</h2>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      padding: '20px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Navigation Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <button
            onClick={handleBackToDashboard}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            ← Back to Dashboard
          </button>
          
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Logout
          </button>
        </div>
        
        {/* Header */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ 
            color: '#333', 
            margin: '0 0 8px 0', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px' 
          }}>
            <span style={{ fontSize: '32px' }}>⌚</span>
            Fitbit Dashboard
          </h1>
          <p style={{ 
            color: '#666', 
            margin: '0 0 16px 0', 
            fontSize: '16px' 
          }}>
            Welcome back, {user?.email}! Here's your fitness data.
          </p>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            {fitbitData?.lastSync && (
              <div style={{
                backgroundColor: '#e7f3ff',
                border: '1px solid #b3d9ff',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '14px',
                color: '#0066cc',
                flex: '1',
                minWidth: '250px'
              }}>
                <strong>📊 Last Updated:</strong> {new Date(fitbitData.lastSync).toLocaleString()}
              </div>
            )}
            
            <button
              onClick={refreshData}
              disabled={loading}
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                opacity: loading ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    border: '2px solid transparent',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  Updating...
                </>
              ) : (
                <>🔄 Refresh All Data</>
              )}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <ErrorDisplay 
            error={error} 
            onRetry={status === 'connected' ? refreshData : null}
          />
        )}

        {/* Connection Status */}
        {status === 'needs_connection' && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '40px',
            textAlign: 'center',
            marginBottom: '24px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            border: '2px dashed #007bff'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>⌚</div>
            <h2 style={{ color: '#333', marginBottom: '16px' }}>Connect Your Fitbit</h2>
            <p style={{ color: '#666', marginBottom: '24px', fontSize: '16px' }}>
              Connect your Fitbit account to start tracking your fitness data and view detailed analytics.
            </p>
            <button
              onClick={startFitbitConnection}
              disabled={connecting}
              style={{
                backgroundColor: '#00b0ff',
                color: 'white',
                border: 'none',
                padding: '16px 32px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: connecting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 auto',
                opacity: connecting ? 0.6 : 1
              }}
            >
              {connecting ? (
                <>
                  <div style={{
                    border: '2px solid transparent',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  Connecting...
                </>
              ) : (
                <>🔗 Connect Fitbit</>
              )}
            </button>
          </div>
        )}

        {/* Connected Dashboard */}
        {status === 'connected' && fitbitData && (
          <>
            {/* Timeseries Chart */}
            <TimeseriesChart />
            
            {/* Metrics Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '20px',
              marginBottom: '24px'
            }}>
              <MetricCard
                title="Steps Today"
                value={fitbitData.steps?.toLocaleString() || '0'}
                unit="steps"
                icon="👟"
                color="#28a745"
              />
              
              <MetricCard
                title="Calories Burned"
                value={fitbitData.calories?.toLocaleString() || '0'}
                unit="calories"
                icon="🔥"
                color="#dc3545"
              />
              
              <MetricCard
                title="Distance"
                value={fitbitData.distance ? (fitbitData.distance).toFixed(2) : '0'}
                unit="km"
                icon="🏃‍♂️"
                color="#007bff"
              />
              
              <MetricCard
                title="Active Minutes"
                value={fitbitData.activeMinutes?.toString() || '0'}
                unit="minutes"
                icon="⚡"
                color="#fd7e14"
              />
            </div>

            {/* Additional Data Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px',
              marginBottom: '24px'
            }}>
              
              {/* Heart Rate Card */}
              {fitbitData.heartRate && (
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '24px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                  border: '3px solid #e91e63'
                }}>
                  <h3 style={{ 
                    color: '#e91e63', 
                    margin: '0 0 16px 0', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px' 
                  }}>
                    <span style={{ fontSize: '24px' }}>❤️</span>
                    Heart Rate
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
                        {fitbitData.heartRate.restingHeartRate || 'N/A'}
                      </div>
                      <div style={{ color: '#666', fontSize: '12px' }}>Resting BPM</div>
                    </div>
                    
                    {fitbitData.heartRate.zones && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
                          {fitbitData.heartRate.zones.length}
                        </div>
                        <div style={{ color: '#666', fontSize: '12px' }}>HR Zones</div>
                      </div>
                    )}
                  </div>
                  
                  {fitbitData.heartRate.zones && fitbitData.heartRate.zones.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
                        Heart Rate Zones:
                      </div>
                      {fitbitData.heartRate.zones.map((zone, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 0',
                          fontSize: '12px',
                          borderBottom: index < fitbitData.heartRate.zones.length - 1 ? '1px solid #eee' : 'none'
                        }}>
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
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '24px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                  border: '3px solid #6f42c1'
                }}>
                  <h3 style={{ 
                    color: '#6f42c1', 
                    margin: '0 0 16px 0', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px' 
                  }}>
                    <span style={{ fontSize: '24px' }}>😴</span>
                    Sleep
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
                        {fitbitData.sleep.totalMinutes ? 
                          Math.floor(fitbitData.sleep.totalMinutes / 60) + 'h ' + 
                          (fitbitData.sleep.totalMinutes % 60) + 'm' : 'N/A'}
                      </div>
                      <div style={{ color: '#666', fontSize: '12px' }}>Total Sleep</div>
                    </div>
                    
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
                        {fitbitData.sleep.efficiency || 'N/A'}%
                      </div>
                      <div style={{ color: '#666', fontSize: '12px' }}>Efficiency</div>
                    </div>
                  </div>
                  
                  {fitbitData.sleep.stages && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
                        Sleep Stages:
                      </div>
                      {Object.entries(fitbitData.sleep.stages).map(([stage, minutes]) => (
                        <div key={stage} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 0',
                          fontSize: '12px',
                          borderBottom: '1px solid #eee'
                        }}>
                          <span style={{ textTransform: 'capitalize' }}>{stage}:</span>
                          <span>{minutes} min</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Weight Card */}
              {fitbitData.weight && (
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '24px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                  border: '3px solid #20c997'
                }}>
                  <h3 style={{ 
                    color: '#20c997', 
                    margin: '0 0 16px 0', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px' 
                  }}>
                    <span style={{ fontSize: '24px' }}>⚖️</span>
                    Weight
                  </h3>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
                      {fitbitData.weight.weight ? fitbitData.weight.weight.toFixed(1) : 'N/A'}
                    </div>
                    <div style={{ color: '#666', fontSize: '14px' }}>kg</div>
                    
                    {fitbitData.weight.date && (
                      <div style={{
                        marginTop: '12px',
                        fontSize: '12px',
                        color: '#666',
                        backgroundColor: '#f8f9fa',
                        padding: '8px',
                        borderRadius: '4px'
                      }}>
                        Last measured: {new Date(fitbitData.weight.date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          marginTop: '24px'
        }}>
          <p style={{ 
            color: '#666', 
            margin: '0', 
            fontSize: '14px' 
          }}>
            🔒 Your data is securely stored and synchronized with Fitbit's official API
          </p>
          
          {userData?.fitbitData?.connectedAt && (
            <p style={{
              color: '#999',
              margin: '8px 0 0 0',
              fontSize: '12px'
            }}>
              Connected since: {new Date(userData.fitbitData.connectedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* CSS Animation Keyframes */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default FitbitDashboard;