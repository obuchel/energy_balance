//const fetch = require('node-fetch');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const getDeviceSyncStatus = async (accessToken) => {
  console.log('📱 Checking device sync status...');
  
  try {
    const response = await fetch('https://api.fitbit.com/1/user/-/devices.json', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Devices API failed: ${response.status}`);
    }
    
    const devices = await response.json();
    console.log('📱 Devices data:', JSON.stringify(devices, null, 2));
    
    // Find the main device (usually the first one)
    const mainDevice = devices[0];
    
    if (mainDevice) {
      const lastSyncTime = new Date(mainDevice.lastSyncTime);
      const now = new Date();
      const syncAgeMinutes = Math.floor((now - lastSyncTime) / (1000 * 60));
      
      return {
        deviceType: mainDevice.deviceVersion,
        batteryLevel: mainDevice.batteryLevel,
        lastSyncTime: mainDevice.lastSyncTime,
        syncAgeMinutes,
        isRecentSync: syncAgeMinutes < 30, // Consider recent if within 30 minutes
        deviceId: mainDevice.id
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ Error getting device sync status:', error);
    return null;
  }
};

// SINGLE, COMPLETE fetchFitbitData function with all features
const fetchFitbitData = async (accessToken) => {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Get both activity data AND device sync status in parallel
    const [activityResponse, deviceSyncStatus] = await Promise.all([
      fetch(`https://api.fitbit.com/1/user/-/activities/date/${today}.json`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }),
      getDeviceSyncStatus(accessToken)
    ]);
    
    if (!activityResponse.ok) {
      const errorText = await activityResponse.text();
      throw new Error(`Fitbit API error (${activityResponse.status}): ${errorText}`);
    }
    
    const activity = await activityResponse.json();
    
    // Add debugging logs
    console.log('📊 Raw activity data:', JSON.stringify(activity, null, 2));
    console.log('📊 Summary:', JSON.stringify(activity.summary, null, 2));
    console.log('📱 Device sync status:', deviceSyncStatus);
    
    // Try to fetch heart rate data
    let heartRate = null;
    try {
      const heartRateResponse = await fetch(`https://api.fitbit.com/1/user/-/activities/heart/date/${today}/1d.json`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (heartRateResponse.ok) {
        const heartRateData = await heartRateResponse.json();
        heartRate = heartRateData?.['activities-heart']?.[0]?.value?.restingHeartRate || null;
      }
    } catch (hrError) {
      console.log('Heart rate data not available:', hrError.message);
    }
    
    // FIXED: Better distance parsing
    const distances = activity.summary?.distances || [];
    console.log('📏 Distances array:', JSON.stringify(distances, null, 2));
    
    // Find the "total" distance or fallback to first entry
    const totalDistance = distances.find(d => d.activity === "total") || distances[0];
    const distance = totalDistance ? parseFloat(totalDistance.distance) : 0;
    
    // FIXED: Better data extraction with logging
    const steps = activity.summary?.steps || 0;
    const calories = activity.summary?.caloriesOut || 0;
    const fairlyActive = activity.summary?.fairlyActiveMinutes || 0;
    const veryActive = activity.summary?.veryActiveMinutes || 0;
    const activeMinutes = fairlyActive + veryActive;
    
    console.log('✅ Parsed data:', {
      steps,
      calories,
      distance,
      activeMinutes,
      fairlyActive,
      veryActive,
      heartRate,
      deviceSyncStatus
    });
    
    return {
      heartRate,
      steps,
      calories,
      distance,
      activeMinutes,
      date: today,
      lastSync: new Date().toISOString(),
      // Add device sync information
      deviceSync: deviceSyncStatus
    };
    
  } catch (error) {
    console.error('Error fetching Fitbit data:', error);
    throw new Error(`Failed to fetch Fitbit data: ${error.message}`);
  }
};

const refreshFitbitToken = async (refreshToken) => {
  const clientId = process.env.FITBIT_CLIENT_ID;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Fitbit credentials not configured');
  }
  
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  try {
    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw new Error(`Failed to refresh token: ${error.message}`);
  }
};

const exchangeCodeForTokens = async (authCode, redirectUri) => {
  const clientId = process.env.FITBIT_CLIENT_ID;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Fitbit credentials not configured');
  }
  
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  try {
    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: redirectUri
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    throw new Error(`Failed to exchange code for tokens: ${error.message}`);
  }
};

module.exports = {
  fetchFitbitData,
  refreshFitbitToken,
  exchangeCodeForTokens,
  getDeviceSyncStatus
};