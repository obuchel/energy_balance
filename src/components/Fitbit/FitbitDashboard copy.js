// FitbitDashboard.js - Updated for secure serverless token exchange
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
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
      
      // Add metadata
      const fitbitDataWithMeta = {
        ...data,
        date: new Date().toISOString().split('T')[0],
        lastSync: new Date().toISOString(),
      };
      
      // Update Firestore
      await setDoc(doc(db, 'users', userId), {
        latestFitbitData: fitbitDataWithMeta,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      
      // Update local state
      setFitbitData(fitbitDataWithMeta);
      
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
  }, [userData?.fitbitData]);

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

  // Refresh data
  const refreshData = useCallback(() => {
    if (userData?.fitbitData?.accessToken && user?.uid) {
      fetchFitbitData(
        userData.fitbitData.accessToken, 
        user.uid, 
        userData.fitbitData.refreshToken
      );
    }
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

            {/* Data Display */}
            {fitbitData && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '24px'
              }}>
                <MetricCard
                  title="Steps Today"
                  value={fitbitData.steps?.toLocaleString() || 'N/A'}
                  unit="steps"
                  icon="👟"
                  color="#28a745"
                />
                <MetricCard
                  title="Calories Burned"
                  value={fitbitData.calories?.toLocaleString() || 'N/A'}
                  unit="calories"
                  icon="🔥"
                  color="#dc3545"
                />
                <MetricCard
                  title="Distance"
                  value={fitbitData.distance ? `${fitbitData.distance.toFixed(2)}` : 'N/A'}
                  unit="miles"
                  icon="📏"
                  color="#007bff"
                />
                <MetricCard
                  title="Active Minutes"
                  value={fitbitData.activeMinutes || 'N/A'}
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

        {/* Debug Info */}
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
          <strong>Debug Info:</strong><br />
          Status: {status}<br />
          User ID: {user?.uid}<br />
          Email: {userData?.email}<br />
          Has Fitbit Tokens: {userData?.fitbitData?.accessToken ? 'Yes' : 'No'}<br />
          Token Expires: {userData?.fitbitData?.tokenExpiresAt ? new Date(userData.fitbitData.tokenExpiresAt).toLocaleString() : 'N/A'}<br />
          Environment: {window.location.hostname}<br />
          Current URL: {window.location.href}<br />
          API Endpoint: {API_BASE_URL}<br />
          Deployment: Secure Serverless (AWS Lambda)
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