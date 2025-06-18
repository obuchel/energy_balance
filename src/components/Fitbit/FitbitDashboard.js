// FitbitDashboard.js - Enhanced with comprehensive debugging
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../../firebase-config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const FitbitDashboard = () => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [fitbitData, setFitbitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('checking'); // checking, needs_connection, connected, error
  const navigate = useNavigate();
  const location = useLocation();

  // Your serverless API base URL
  const API_BASE_URL = 'https://6zfuwxqp01.execute-api.us-east-1.amazonaws.com/dev';

  // ENHANCED: Fetch Fitbit data from your serverless API with detailed debugging
  const fetchFitbitDataFromAPI = async (accessToken, retryCount = 0) => {
    console.log('📡 === FETCHING FROM SERVERLESS API ===');
    console.log('🔑 Access Token Check:', {
      exists: !!accessToken,
      type: typeof accessToken,
      length: accessToken?.length,
      preview: accessToken?.substring(0, 20) + '...',
      isString: typeof accessToken === 'string',
      isEmpty: accessToken === '' || accessToken === null || accessToken === undefined
    });
    console.log('📝 Retry attempt:', retryCount);
    
    // Validate access token before making request
    if (!accessToken || typeof accessToken !== 'string' || accessToken.trim() === '') {
      throw new Error('Invalid access token: Token is null, undefined, or empty');
    }
    
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    
    console.log('📋 Request Headers:', {
      'Authorization': `Bearer ${accessToken.substring(0, 20)}...`,
      'Content-Type': headers['Content-Type'],
      'API_URL': API_BASE_URL
    });
    
    try {
      console.log('📡 Making request to:', `${API_BASE_URL}/fitbit`);
      
      const response = await fetch(`${API_BASE_URL}/fitbit`, {
        method: 'GET',
        headers: headers
      });
      
      console.log('📡 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        // Try to parse error response
        let errorData;
        try {
          errorData = JSON.parse(errorText);
          console.error('❌ Parsed error:', errorData);
        } catch (parseError) {
          console.error('❌ Could not parse error response as JSON');
        }
        
        throw new Error(`API request failed (${response.status}): ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Data received successfully:', data);
      
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
      console.error('❌ Fetch error:', error);
      
      // Implement retry logic for temporary failures
      if (retryCount < 2 && !error.message.includes('401') && !error.message.includes('403')) {
        console.log('🔄 Retrying API call in 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchFitbitDataFromAPI(accessToken, retryCount + 1);
      }
      
      throw new Error(`Failed to fetch Fitbit data: ${error.message}`);
    }
  };

  // ENHANCED: Refresh Fitbit token with better error handling


  // ENHANCED: Fetch Fitbit data with automatic token refresh and detailed debugging
// FIXED: Enhanced fetchFitbitData with better token refresh logic
const fetchFitbitData = useCallback(async (accessToken, userId, refreshToken = null) => {
  try {
    console.log('🔄 === FETCHING FRESH FITBIT DATA ===');
    console.log('📝 Access token (first 10 chars):', accessToken?.substring(0, 10) + '...');
    console.log('🔄 Refresh token available:', !!refreshToken);
    console.log('👤 User ID:', userId);
    
    setLoading(true);
    setError('');
    
    // Check if token is expired
    const tokenData = userData?.fitbitData;
    const tokenExpiresAt = tokenData?.tokenExpiresAt;
    const now = new Date();
    const expiryDate = tokenExpiresAt ? new Date(tokenExpiresAt) : null;
    const tokenExpired = expiryDate && now > expiryDate;
    
    console.log('📅 Token expiry check:', {
      now: now.toISOString(),
      expiresAt: tokenExpiresAt,
      isExpired: tokenExpired,
      minutesUntilExpiry: expiryDate ? Math.round((expiryDate - now) / (1000 * 60)) : 'N/A'
    });
    
    let currentAccessToken = accessToken;
    let shouldRefreshToken = tokenExpired;
    
    // ATTEMPT 1: Try with current token first
    try {
      console.log('📡 Attempting API call with current token...');
      const data = await fetchFitbitDataFromAPI(currentAccessToken);
      
      // If successful, update Firestore and return
      const fitbitDataWithMeta = {
        ...data,
        date: new Date().toISOString().split('T')[0],
        lastSync: new Date().toISOString(),
      };
      
      await setDoc(doc(db, 'users', userId), {
        latestFitbitData: fitbitDataWithMeta,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      
      setFitbitData(fitbitDataWithMeta);
      console.log('✅ Fitbit data updated successfully with current token');
      return;
      
    } catch (apiError) {
      console.log('⚠️ API call failed with current token:', apiError.message);
      
      // Check if it's a token expiry error
      if (apiError.message.includes('401') || 
          apiError.message.includes('expired_token') || 
          apiError.message.includes('Unauthorized')) {
        console.log('🔄 Token appears to be expired, will attempt refresh...');
        shouldRefreshToken = true;
      } else {
        // If it's not a token issue, throw the error
        throw apiError;
      }
    }
    
    // ATTEMPT 2: Refresh token if needed and retry
    if (shouldRefreshToken && refreshToken) {
      try {
        console.log('🔄 Token expired or invalid, attempting refresh...');
        const newTokenData = await refreshFitbitToken(refreshToken);
        
        // Update Firestore with new tokens
        console.log('💾 Saving new tokens to Firestore...');
        const updatedFitbitData = {
          ...tokenData,
          accessToken: newTokenData.accessToken,
          refreshToken: newTokenData.refreshToken,
          tokenExpiresAt: newTokenData.tokenExpiresAt,
        };
        
        await setDoc(doc(db, 'users', userId), {
          fitbitData: updatedFitbitData
        }, { merge: true });
        
        // Update local state
        setUserData(prev => ({
          ...prev,
          fitbitData: updatedFitbitData
        }));
        
        currentAccessToken = newTokenData.accessToken;
        console.log('✅ Token refreshed successfully, retrying API call...');
        
        // Retry API call with new token
        const data = await fetchFitbitDataFromAPI(currentAccessToken);
        
        const fitbitDataWithMeta = {
          ...data,
          date: new Date().toISOString().split('T')[0],
          lastSync: new Date().toISOString(),
        };
        
        await setDoc(doc(db, 'users', userId), {
          latestFitbitData: fitbitDataWithMeta,
          lastUpdated: new Date().toISOString()
        }, { merge: true });
        
        setFitbitData(fitbitDataWithMeta);
        console.log('✅ Fitbit data updated successfully with refreshed token');
        
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        
        // Handle specific refresh token errors
        if (refreshError.message.includes('REFRESH_TOKEN_EXPIRED') || 
            refreshError.message.includes('INVALID_REFRESH_TOKEN') ||
            refreshError.message.includes('401') ||
            refreshError.message.includes('400')) {
          setError('Your Fitbit authorization has completely expired. Please reconnect your account to continue syncing data.');
        } else {
          setError(`Token refresh failed: ${refreshError.message}`);
        }
        
        setStatus('needs_connection');
        return;
      }
    } else if (shouldRefreshToken && !refreshToken) {
      console.error('❌ Token expired but no refresh token available');
      setError('Your Fitbit session has expired and no refresh token is available. Please reconnect your account.');
      setStatus('needs_connection');
      return;
    }
    
  } catch (err) {
    console.error('❌ Error fetching Fitbit data:', err);
    console.error('❌ Full error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    
    // Handle specific error cases with better messaging
    if (err.message.includes('401') || err.message.includes('Unauthorized')) {
      setError('Your Fitbit session has expired. Please reconnect your account.');
      setStatus('needs_connection');
    } else if (err.message.includes('402')) {
      setError('Fitbit API rate limit exceeded. Please try again in a few minutes.');
    } else if (err.message.includes('403')) {
      setError('Access denied by Fitbit. Please check your permissions and reconnect.');
      setStatus('needs_connection');
    } else if (err.message.includes('429')) {
      setError('Too many requests to Fitbit. Please wait a moment and try again.');
    } else if (err.message.includes('500')) {
      setError('Fitbit service is temporarily unavailable. Please try again later.');
    } else {
      setError(`Failed to fetch Fitbit data: ${err.message}`);
    }
  } finally {
    setLoading(false);
  }
}, [userData?.fitbitData]);

// ADD: Force reconnect function for when refresh tokens fail
const forceReconnect = async () => {
  try {
    console.log('🔄 Forcing Fitbit reconnection...');
    
    // Clear Fitbit data from Firestore
    await setDoc(doc(db, 'users', user.uid), {
      fitbitData: null,
      deviceConnected: false,
      selectedDevice: null,
      latestFitbitData: null
    }, { merge: true });
    
    // Reset local state
    setUserData(prev => ({ 
      ...prev, 
      fitbitData: null 
    }));
    setFitbitData(null);
    setStatus('needs_connection');
    setError('');
    
    console.log('✅ Cleared Fitbit connection - ready to reconnect');
  } catch (error) {
    console.error('Error clearing connection:', error);
    setError('Failed to clear connection. Please refresh the page and try again.');
  }
};

// ENHANCED: Better refresh token function with specific error handling
const refreshFitbitToken = async (refreshToken) => {
  console.log('🔄 Refreshing Fitbit token...');
  console.log('📝 Refresh token (first 10 chars):', refreshToken?.substring(0, 10) + '...');
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
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
    
    console.log('🔄 Refresh response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Refresh error response:', errorText);
      
      // Try to parse the error response
      let errorData;
      try {
        errorData = JSON.parse(errorText);
        console.error('❌ Parsed refresh error:', errorData);
      } catch (parseError) {
        console.log('Could not parse refresh error as JSON');
      }
      
      // Check for specific Fitbit error codes
      if (response.status === 401) {
        throw new Error('REFRESH_TOKEN_EXPIRED');
      } else if (response.status === 400) {
        throw new Error('INVALID_REFRESH_TOKEN');
      }
      
      throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
    }
    
    const tokenData = await response.json();
    console.log('✅ Token refreshed successfully');
    console.log('📝 New token expires in:', tokenData.expires_in, 'seconds');
    
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    };
    
  } catch (error) {
    console.error('❌ Error refreshing token:', error);
    
    // Add specific error messages for debugging
    if (error.message === 'REFRESH_TOKEN_EXPIRED') {
      console.error('🔥 Refresh token has expired - user needs to re-authenticate');
    } else if (error.message === 'INVALID_REFRESH_TOKEN') {
      console.error('🔥 Refresh token is invalid - user needs to re-authenticate');
    }
    
    throw error;
  }
};

  // ENHANCED: Debug API connection function
  const debugApiConnection = async () => {
    console.log('🧪 === DEBUG API CONNECTION ===');
    
    // Test 1: Check if API_BASE_URL is correct
    console.log('🔗 API Base URL:', API_BASE_URL);
    
    // Test 2: Check health endpoint
    try {
      console.log('🏥 Testing health endpoint...');
      const healthResponse = await fetch(`${API_BASE_URL}/health`);
      const healthData = await healthResponse.json();
      console.log('✅ Health check result:', healthData);
      setError('✅ Health check successful! API is responding.');
    } catch (error) {
      console.error('❌ Health check failed:', error);
      setError(`❌ Health check failed: ${error.message}`);
    }
    
    // Test 3: Check if we have tokens
    console.log('🔑 Token Status:', {
      hasAccessToken: !!userData?.fitbitData?.accessToken,
      hasRefreshToken: !!userData?.fitbitData?.refreshToken,
      tokenExpiry: userData?.fitbitData?.tokenExpiresAt,
      isTokenExpired: userData?.fitbitData?.tokenExpiresAt ? 
        new Date() > new Date(userData.fitbitData.tokenExpiresAt) : 'Unknown'
    });
    
    // Test 4: Try the actual API call if we have a token
    if (userData?.fitbitData?.accessToken) {
      try {
        console.log('📡 Testing Fitbit API call...');
        const testResponse = await fetch(`${API_BASE_URL}/fitbit`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${userData.fitbitData.accessToken}`,
            'Content-Type': 'application/json',
          }
        });
        
        console.log('📡 Test API Response:', {
          status: testResponse.status,
          ok: testResponse.ok,
          statusText: testResponse.statusText
        });
        
        if (testResponse.ok) {
          const testData = await testResponse.json();
          console.log('✅ Test API Success:', testData);
          setError('✅ API test successful! Your connection is working.');
        } else {
          const errorText = await testResponse.text();
          console.error('❌ Test API Failed:', errorText);
          setError(`❌ API test failed (${testResponse.status}): ${errorText}`);
        }
      } catch (error) {
        console.error('❌ Test API Error:', error);
        setError(`❌ API test error: ${error.message}`);
      }
    } else {
      console.error('❌ No access token available for testing');
      setError('❌ No access token available. Please reconnect your Fitbit account.');
    }
  };

  // Load user data from Firestore
  const loadUserData = useCallback(async (userId) => {
    try {
      setLoading(true);
      console.log('📊 Loading user data for:', userId);

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
  }, []);

  // Start Fitbit OAuth connection
  const startFitbitConnection = () => {
    if (!user?.uid) {
      setError('User not authenticated');
      return;
    }
  
    setConnecting(true);
    setError('');
    
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
    
    // FIXED: Handle GitHub Pages redirect URI correctly
    // Remove any existing query params and hash
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, '');
    const cleanUrl = baseUrl.split('?')[0].split('#')[0];
    const redirectUri = cleanUrl;
    
    const scope = 'activity heartrate sleep weight profile';
    
    const authUrl = `https://www.fitbit.com/oauth2/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=${state}`;
    
    console.log('🚀 Starting Fitbit OAuth flow');
    console.log('Auth URL:', authUrl);
    console.log('Redirect URI:', redirectUri);
    
    // Store the redirect URI for later use
    sessionStorage.setItem('fitbitRedirectUri', redirectUri);
    
    // Redirect to Fitbit
    window.location.href = authUrl;
  };
  
  // 2. Update the token exchange to use the stored redirect URI
  const exchangeCodeForTokens = async (authCode) => {
    console.log('🔧 Starting secure token exchange...');
    
    // Use the stored redirect URI from session storage
    const redirectUri = sessionStorage.getItem('fitbitRedirectUri') || 
                        window.location.origin + window.location.pathname.replace(/\/$/, '').split('?')[0].split('#')[0];
    
    try {
      console.log('📡 Calling serverless token exchange endpoint...');
      console.log('Using redirect URI:', redirectUri);
      
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

  // ENHANCED: Refresh data with detailed logging
  const refreshData = useCallback(() => {
    console.log('🔄 === REFRESH DATA CALLED ===');
    console.log('📊 userData:', userData);
    console.log('🔑 Access Token Available:', !!userData?.fitbitData?.accessToken);
    console.log('🔑 Access Token Preview:', userData?.fitbitData?.accessToken?.substring(0, 20) + '...');
    console.log('🔄 Refresh Token Available:', !!userData?.fitbitData?.refreshToken);
    console.log('👤 User UID:', user?.uid);
    
    // Check if we have the required data
    if (!userData?.fitbitData?.accessToken) {
      console.error('❌ No access token available');
      setError('No access token found. Please reconnect your Fitbit account.');
      setStatus('needs_connection');
      return;
    }
    
    if (!user?.uid) {
      console.error('❌ No user ID available');
      setError('User not authenticated. Please log in again.');
      return;
    }
    
    console.log('✅ Required data available, proceeding with fetch...');
    
    fetchFitbitData(
      userData.fitbitData.accessToken, 
      user.uid, 
      userData.fitbitData.refreshToken
    );
  }, [userData?.fitbitData?.accessToken, userData?.fitbitData?.refreshToken, user?.uid, fetchFitbitData]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        console.log('✅ User authenticated:', currentUser.uid);
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

  // NEW: Debug Section Component
 // ENHANCED: Debug Section Component with Force Reconnect
const DebugSection = () => (
  <div style={{
    backgroundColor: '#fff3cd',
    border: '1px solid #ffeaa7',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    color: '#856404'
  }}>
    <h4>🐛 Debug Tools (Remove when fixed)</h4>
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
      <button onClick={debugApiConnection} style={{
        backgroundColor: '#ffc107',
        color: '#212529',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer'
      }}>
        🧪 Test API Connection
      </button>
      
      <button onClick={() => {
        console.log('📊 Current State:', {
          status,
          hasUser: !!user,
          hasUserData: !!userData,
          hasAccessToken: !!userData?.fitbitData?.accessToken,
          hasRefreshToken: !!userData?.fitbitData?.refreshToken,
          tokenExpired: userData?.fitbitData?.tokenExpiresAt ? 
            new Date() > new Date(userData.fitbitData.tokenExpiresAt) : 'Unknown',
          fitbitData,
          loading,
          error
        });
      }} style={{
        backgroundColor: '#17a2b8',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer'
      }}>
        📊 Log Current State
      </button>

      <button onClick={() => {
        console.log('=== DEBUG INFO ===');
        console.log('API_BASE_URL:', API_BASE_URL);
        console.log('userData:', userData);
        console.log('accessToken exists:', !!userData?.fitbitData?.accessToken);
        console.log('accessToken preview:', userData?.fitbitData?.accessToken?.substring(0, 20) + '...');
        console.log('refreshToken exists:', !!userData?.fitbitData?.refreshToken);
        console.log('user.uid:', user?.uid);
        console.log('token expires at:', userData?.fitbitData?.tokenExpiresAt);
        console.log('token is expired:', userData?.fitbitData?.tokenExpiresAt ? 
          new Date() > new Date(userData.fitbitData.tokenExpiresAt) : 'Unknown');
      }} style={{
        backgroundColor: '#fd7e14',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer'
      }}>
        🐛 Debug Log
      </button>
    </div>
    
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      <button onClick={forceReconnect} style={{
        backgroundColor: '#dc3545',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 'bold'
      }}>
        🔄 Force Reconnect Fitbit
      </button>
      
      <button onClick={async () => {
        if (userData?.fitbitData?.refreshToken) {
          try {
            console.log('🔄 Testing refresh token...');
            const newTokens = await refreshFitbitToken(userData.fitbitData.refreshToken);
            console.log('✅ Refresh token test successful:', newTokens);
            setError('✅ Refresh token test successful! New tokens received.');
          } catch (error) {
            console.error('❌ Refresh token test failed:', error);
            setError(`❌ Refresh token test failed: ${error.message}`);
          }
        } else {
          setError('❌ No refresh token available to test');
        }
      }} style={{
        backgroundColor: '#6f42c1',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer'
      }}>
        🔄 Test Refresh Token
      </button>

      <button onClick={() => {
        console.log('📅 Token Expiry Analysis:');
        if (userData?.fitbitData?.tokenExpiresAt) {
          const expiryDate = new Date(userData.fitbitData.tokenExpiresAt);
          const now = new Date();
          const minutesUntilExpiry = Math.round((expiryDate - now) / (1000 * 60));
          const isExpired = now > expiryDate;
          
          console.log({
            tokenExpiresAt: userData.fitbitData.tokenExpiresAt,
            expiryDate: expiryDate.toLocaleString(),
            currentTime: now.toLocaleString(),
            minutesUntilExpiry,
            isExpired,
            timeUntilExpiry: isExpired ? 'EXPIRED' : `${Math.abs(minutesUntilExpiry)} minutes`
          });
          
          setError(isExpired ? 
            `❌ Token expired ${Math.abs(minutesUntilExpiry)} minutes ago` : 
            `✅ Token expires in ${minutesUntilExpiry} minutes`
          );
        } else {
          console.log('No token expiry date found');
          setError('❌ No token expiry information available');
        }
      }} style={{
        backgroundColor: '#28a745',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer'
      }}>
        📅 Check Token Expiry
      </button>
    </div>
    
    <div style={{ marginTop: '10px', fontSize: '12px', color: '#6c5a00' }}>
      <strong>Quick Fix:</strong> If refresh keeps failing, click "🔄 Force Reconnect Fitbit" to start fresh.
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
          <h1 style={{ margin: '0 0 8px 0', color: '#333' }}>
            Fitbit Dashboard 📱
          </h1>
          <p style={{ margin: '0', color: '#666' }}>
            {userData?.email || 'Loading...'} • {status === 'connected' ? 'Connected via Secure Serverless API' : 'Not Connected'}
          </p>
        </div>

        {/* NEW: Debug Section - Add this temporarily for debugging */}
        <DebugSection />

        {/* Error Display */}
        {error && (
          <ErrorDisplay 
            error={error} 
            onRetry={userData?.fitbitData?.accessToken ? refreshData : null}
          />
        )}

        {/* Connection Status */}
        {status === 'needs_connection' && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '40px',
            textAlign: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            marginBottom: '24px'
          }}>
            <h2 style={{ color: '#333', marginBottom: '16px' }}>Connect Your Fitbit</h2>
            <p style={{ color: '#666', marginBottom: '24px', fontSize: '16px' }}>
              To view your health data, we need to connect to your Fitbit account.
            </p>
            <button
              onClick={startFitbitConnection}
              disabled={connecting}
              style={{
                backgroundColor: '#00B2A9',
                color: 'white',
                border: 'none',
                padding: '16px 32px',
                borderRadius: '8px',
                cursor: connecting ? 'not-allowed' : 'pointer',
                fontSize: '18px',
                fontWeight: '600',
                opacity: connecting ? 0.6 : 1,
                boxShadow: '0 4px 12px rgba(0,178,169,0.3)'
              }}
            >
              {connecting ? '🔄 Connecting...' : '🔗 Connect Fitbit'}
            </button>
          </div>
        )}

        {/* Success Message for New Connections */}
        {status === 'connected' && (!fitbitData || (!fitbitData.steps && !fitbitData.calories)) && (
          <div style={{
            backgroundColor: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
            color: '#155724'
          }}>
            <strong>🎉 Fitbit Connected Successfully!</strong><br />
            Your Fitbit account is now linked through our secure serverless API. Click the "Refresh" button below to load your latest health data.
          </div>
        )}

        {/* Connected - Show Refresh Button and Data */}
        {status === 'connected' && (
          <>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', color: '#333' }}>✅ Fitbit Connected (Secure Serverless API)</h3>
                  <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                    {fitbitData?.lastSync ? 
                      `Last sync: ${new Date(fitbitData.lastSync).toLocaleString()}` : 
                      'Click refresh to load your data'
                    }
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={refreshData}
                    disabled={loading}
                    style={{
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '6px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    {loading ? '🔄 Loading...' : '🔄 Refresh'}
                  </button>
                </div>
              </div>
            </div>

            {/* Data Display - FIXED TO HANDLE ZERO VALUES */}
            {fitbitData && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '24px'
              }}>
                <MetricCard
                  title="Steps Today"
                  value={fitbitData.steps !== undefined && fitbitData.steps !== null ? fitbitData.steps.toLocaleString() : 'N/A'}
                  unit="steps"
                  icon="👟"
                  color="#28a745"
                />
                <MetricCard
                  title="Calories Burned"
                  value={fitbitData.calories !== undefined && fitbitData.calories !== null ? fitbitData.calories.toLocaleString() : 'N/A'}
                  unit="calories"
                  icon="🔥"
                  color="#dc3545"
                />
                <MetricCard
                  title="Distance"
                  value={fitbitData.distance !== undefined && fitbitData.distance !== null ? fitbitData.distance.toFixed(2) : 'N/A'}
                  unit="miles"
                  icon="📏"
                  color="#007bff"
                />
                <MetricCard
                  title="Active Minutes"
                  value={fitbitData.activeMinutes !== undefined && fitbitData.activeMinutes !== null ? fitbitData.activeMinutes.toString() : 'N/A'}
                  unit="minutes"
                  icon="⚡"
                  color="#ffc107"
                />
                {fitbitData.heartRate && (
                  <MetricCard
                    title="Resting Heart Rate"
                    value={fitbitData.heartRate}
                    unit="bpm"
                    icon="❤️"
                    color="#e83e8c"
                  />
                )}
                {fitbitData.sleep && (
                  <>
                    <MetricCard
                      title="Sleep Duration"
                      value={Math.round(fitbitData.sleep.totalMinutesAsleep / 60 * 10) / 10}
                      unit="hours"
                      icon="😴"
                      color="#6f42c1"
                    />
                    <MetricCard
                      title="Sleep Efficiency"
                      value={fitbitData.sleep.efficiency}
                      unit="%"
                      icon="⭐"
                      color="#20c997"
                    />
                  </>
                )}
                {fitbitData.weight && (
                  <MetricCard
                    title="Weight"
                    value={fitbitData.weight.weight}
                    unit="lbs"
                    icon="⚖️"
                    color="#fd7e14"
                  />
                )}
              </div>
            )}
          </>
        )}

        {/* Serverless API Info */}
        <div style={{
          backgroundColor: '#e7f3ff',
          border: '1px solid #b8daff',
          borderRadius: '8px',
          padding: '16px',
          marginTop: '24px',
          color: '#004085'
        }}>
          <strong>🔒 Secure Serverless Deployment:</strong><br />
          This app uses secure serverless API endpoints where your Fitbit client secret is safely stored on the backend, never exposed to the frontend.
          <br />
          <strong>API:</strong> {API_BASE_URL}
        </div>

        {/* ENHANCED Debug Info */}
        <div style={{
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '16px',
          marginTop: '24px',
          fontSize: '12px',
          fontFamily: 'monospace',
          color: '#495057'
        }}>
          <strong>Enhanced Debug Info:</strong><br />
          Status: {status}<br />
          User ID: {user?.uid}<br />
          Email: {userData?.email}<br />
          Has Fitbit Tokens: {userData?.fitbitData?.accessToken ? 'Yes' : 'No'}<br />
          Token Expires: {userData?.fitbitData?.tokenExpiresAt ? new Date(userData.fitbitData.tokenExpiresAt).toLocaleString() : 'N/A'}<br />
          Token Valid: {userData?.fitbitData?.tokenExpiresAt ? (new Date() < new Date(userData.fitbitData.tokenExpiresAt) ? '✅ Valid' : '❌ Expired') : 'N/A'}<br />
          Has Refresh Token: {userData?.fitbitData?.refreshToken ? 'Yes' : 'No'}<br />
          Environment: {window.location.hostname}<br />
          Current URL: {window.location.href}<br />
          API Endpoint: {API_BASE_URL}<br />
          Last Sync: {fitbitData?.lastSync ? new Date(fitbitData.lastSync).toLocaleString() : 'Never'}<br />
          FitbitData: {fitbitData ? JSON.stringify(fitbitData) : 'null'}
        </div>

      </div>

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