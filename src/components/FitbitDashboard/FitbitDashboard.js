// FitbitDashboard.js - JavaScript component without embedded CSS
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../../firebase-config';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import "../Common.css";
import './FitbitDashboard.css'; // Import the CSS file

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
          
          // Fix: Use actual timestamp and convert to local time
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

  // Go directly to today
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
    console.log('🐛 DEBUG: Refresh token details:');
    console.log('- refreshToken exists:', !!refreshToken);
    console.log('- refreshToken length:', refreshToken?.length || 0);
    console.log('- API_BASE_URL:', API_BASE_URL);
    
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

      console.log('🐛 DEBUG: Refresh API response:');
      console.log('- status:', response.status);
      console.log('- statusText:', response.statusText);
      console.log('- ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('🐛 DEBUG: Refresh API error response:', errorText);
        
        // Try to parse as JSON for more details
        try {
          const errorJson = JSON.parse(errorText);
          console.log('🐛 DEBUG: Parsed error JSON:', errorJson);
        } catch (parseErr) {
          console.log('🐛 DEBUG: Error response is not JSON');
        }
        
        throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
      }

      const tokenData = await response.json();
      console.log('✅ Token refreshed successfully');
      console.log('🐛 DEBUG: New token data structure:', Object.keys(tokenData));

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      };
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
      console.log('🐛 DEBUG: Network or parsing error during refresh');
      throw error;
    }
  };

  // Enhanced fetch Fitbit data function with debugging
  const fetchFitbitData = useCallback(async (accessToken, userId, refreshToken = null) => {
    try {
      console.log('🔄 Fetching fresh Fitbit data...');
      
      // Enhanced debug logging
      console.log('🐛 DEBUG: Token Debug Info:');
      console.log('- accessToken exists:', !!accessToken);
      console.log('- accessToken length:', accessToken?.length || 0);
      console.log('- refreshToken exists:', !!refreshToken);
      console.log('- refreshToken length:', refreshToken?.length || 0);
      console.log('- userId:', userId);

      setLoading(true);
      setError('');

      // Check if token is expired
      const tokenData = userData?.fitbitData;
      console.log('🐛 DEBUG: Token Data:');
      console.log('- tokenData exists:', !!tokenData);
      console.log('- tokenExpiresAt:', tokenData?.tokenExpiresAt);
      console.log('- current time:', new Date().toISOString());

      const tokenExpired = tokenData?.tokenExpiresAt && new Date() > new Date(tokenData.tokenExpiresAt);
      console.log('🐛 DEBUG: Token expired?', tokenExpired);

      let currentAccessToken = accessToken;

      // Refresh token if expired
      if (tokenExpired && refreshToken) {
        try {
          console.log('🔄 Token expired, refreshing...');
          console.log('🐛 DEBUG: About to call refreshFitbitToken with refreshToken length:', refreshToken.length);
          
          const newTokenData = await refreshFitbitToken(refreshToken);
          
          console.log('🐛 DEBUG: Refresh response:');
          console.log('- new accessToken exists:', !!newTokenData.accessToken);
          console.log('- new refreshToken exists:', !!newTokenData.refreshToken);
          console.log('- new tokenExpiresAt:', newTokenData.tokenExpiresAt);

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
          console.log('🐛 DEBUG: Refresh error details:');
          console.log('- error message:', refreshError.message);
          console.log('- error stack:', refreshError.stack);
          console.log('- refresh token used:', refreshToken?.substring(0, 10) + '...');
          
          setError('Your Fitbit connection has expired. Please reconnect your account.');
          setStatus('needs_connection');
          return;
        }
      }

      // Fetch data using current/refreshed token
      console.log('🐛 DEBUG: About to fetch data with token length:', currentAccessToken?.length || 0);
      const data = await fetchFitbitDataFromAPI(currentAccessToken);

      // Save the fetched data
      await setDoc(doc(db, 'users', userId), {
        latestFitbitData: data,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      setFitbitData(data);
      console.log('✅ Fitbit data updated successfully');

      // Also refresh timeseries data for selected date
      await fetchTimeseriesData(selectedDate, userId);

    } catch (err) {
      console.error('❌ Error fetching Fitbit data:', err);
      console.log('🐛 DEBUG: Main fetch error details:');
      console.log('- error message:', err.message);
      console.log('- error name:', err.name);
      console.log('- error stack:', err.stack);

      // Handle specific error cases
      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        console.log('🐛 DEBUG: 401/Unauthorized error detected');
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

  // Secure token exchange through backend
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

      // Cleanup session storage
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
      
      // 2. Clear local storage
      localStorage.removeItem('userData');
      
      // 3. Navigate to login
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      // Even if Firebase logout fails, clear local storage
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
            disabled={timeseriesLoading || selectedDate >= new Date().toISOString().split('T')[0]}
            className="nav-button"
          >
            Next →
          </button>
          
          {selectedDate !== new Date().toISOString().split('T')[0] && (
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
            {selectedDate === new Date().toISOString().split('T')[0] 
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
          <strong>📈 Summary for {new Date(fitbitData.lastSync).toLocaleString()}:</strong><br />
          Data points: {timeseriesData.length} | 
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
        {/* Animated background elements */}
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
      {/* Animated background elements */}
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
            </div>
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
          <div className="dashboard-card connection-card">
            <div className="card-glow"></div>
            <div className="card-content-wrapper connection-content">
              <div className="connection-icon">⌚</div>
              <h2 className="connection-title">Connect Your Fitbit</h2>
              <p className="connection-description">
                Connect your Fitbit account to start tracking your fitness data and view detailed analytics.
              </p>
              <button
                onClick={startFitbitConnection}
                disabled={connecting}
                className="connect-button"
              >
                {connecting ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    Connecting...
                  </>
                ) : (
                  <>🔗 Connect Fitbit</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Connected Dashboard */}
        {status === 'connected' && fitbitData && (
          <>
            {/* Timeseries Chart */}
            <TimeseriesChart />
            
            {/* Metrics Grid */}
            <div className="metrics-grid">
              <MetricCard
                title="Steps Today"
                value={fitbitData.steps?.toLocaleString() || '0'}
                unit="steps"
                icon="👟"
                color="#10b981"
              />
              
              <MetricCard
                title="Calories Burned"
                value={fitbitData.calories?.toLocaleString() || '0'}
                unit="calories"
                icon="🔥"
                color="#ef4444"
              />
              
              <MetricCard
                title="Distance"
                value={fitbitData.distance ? (fitbitData.distance).toFixed(2) : '0'}
                unit="km"
                icon="🏃‍♂️"
                color="#3b82f6"
              />
              
              <MetricCard
                title="Active Minutes"
                value={fitbitData.activeMinutes?.toString() || '0'}
                unit="minutes"
                icon="⚡"
                color="#f59e0b"
              />
            </div>

            {/* Additional Data Cards */}
            <div className="additional-cards-grid">
              
              {/* Heart Rate Card */}
              {fitbitData.heartRate && (
                <div className="dashboard-card data-card heart-rate-card">
                  <h3 className="data-card-title">
                    <span className="data-card-icon">❤️</span>
                    Heart Rate
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
                    Sleep
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
                    Weight
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
          </>
        )}

        {/* Footer */}
        <div className="dashboard-card footer-card">
          <p className="footer-text">
            🔒 Your data is securely stored and synchronized with Fitbit's official API
          </p>
          
          {userData?.fitbitData?.connectedAt && (
            <p className="footer-connected">
              Connected since: {new Date(userData.fitbitData.connectedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FitbitDashboard;