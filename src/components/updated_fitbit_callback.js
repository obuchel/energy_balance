// Update the exchangeCodeForToken function in your FitbitCallback.js

const exchangeCodeForToken = async (code) => {
  const clientId = process.env.REACT_APP_FITBIT_CLIENT_ID;
  const clientSecret = process.env.REACT_APP_FITBIT_CLIENT_SECRET;
  
  // Determine redirect URI based on current environment (same logic as registration)
  let redirectUri;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isGitHubPages = window.location.hostname.includes('github.io');
  
  if (isLocalhost) {
    redirectUri = process.env.REACT_APP_FITBIT_REDIRECT_URI_DEV || 'http://localhost:3000/fitbit/callback';
  } else if (isGitHubPages) {
    redirectUri = process.env.REACT_APP_FITBIT_REDIRECT_URI_PROD || 'https://obuchel.github.io/energy_balance/fitbit/callback';
  } else {
    // Fallback: try to construct from current location
    redirectUri = `${window.location.origin}/fitbit/callback`;
  }

  console.log('Using Fitbit redirect URI for token exchange:', redirectUri);

  // Create Basic Auth header
  const credentials = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Token exchange failed: ${errorData.error_description || response.statusText}`);
  }

  return await response.json();
};