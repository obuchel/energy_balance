// SOLUTION 1: Create a simple redirect page
// Create public/fitbit-callback.html (static file)

<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Fitbit Callback</title>
    <script>
        // Extract query parameters from current URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        
        // Build the hash URL with parameters
        let hashUrl = '/energy_balance/#/fitbit-callback';
        
        if (code || error) {
            const params = new URLSearchParams();
            if (code) params.set('code', code);
            if (state) params.set('state', state);
            if (error) params.set('error', error);
            hashUrl += '?' + params.toString();
        }
        
        // Redirect to the hash URL
        window.location.replace(hashUrl);
    </script>
</head>
<body>
    <p>Redirecting...</p>
</body>
</html>

// SOLUTION 2: Use Netlify/Vercel (Better long-term)
// Deploy your app to a service that handles SPA routing properly

// For Netlify, create public/_redirects file:
/*
/fitbit-callback /index.html 200
/*    /index.html   200
*/

// For Vercel, create vercel.json:
/*
{
  "rewrites": [
    { "source": "/fitbit-callback", "destination": "/index.html" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
*/

// SOLUTION 3: GitHub Actions deployment with proper routing
// Create .github/workflows/deploy.yml:
/*
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - name: Install dependencies
        run: npm install
      - name: Build
        run: npm run build
      - name: Add 404 redirect
        run: cp build/index.html build/404.html
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./build
*/

// SOLUTION 4: Update your Fitbit settings and app
// 1. Set Fitbit redirect URI to: https://obuchel.github.io/energy_balance/fitbit-callback.html
// 2. Update your .env:
REACT_APP_FITBIT_REDIRECT_URI=https://obuchel.github.io/energy_balance/fitbit-callback.html

// 3. Keep your app using HashRouter as it works
// 4. The static HTML file will handle the redirect to your hash URL

// SOLUTION 5: Use a third-party redirect service
// Services like redirect.pizza or similar can create a simple redirect:
// https://redirect.pizza/your-unique-id -> https://obuchel.github.io/energy_balance/#/fitbit-callback

// SOLUTION 6: Hybrid approach - Update your FitbitCallback to handle both
// Update your FitbitCallback.js to work with direct access:

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const FitbitCallback = () => {
  const [status, setStatus] = useState('processing');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Handle both hash routing and direct routing
    handleFitbitCallback();
  }, []);

  const handleFitbitCallback = async () => {
    try {
      // Check if we're being loaded directly (not through React Router)
      if (window.location.pathname === '/energy_balance/fitbit-callback.html') {
        // This means we came from the static redirect file
        // Parameters should be in the URL search
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        
        if (code) {
          // Process the callback here directly
          await processCallback(code, state);
        }
        return;
      }

      // Normal React Router handling
      const urlParams = new URLSearchParams(location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      if (code) {
        await processCallback(code, state);
      }
    } catch (error) {
      console.error('Callback error:', error);
      setStatus('error');
    }
  };

  const processCallback = async (code, state) => {
    // Your existing callback processing logic
    console.log('Processing callback with code:', code);
    // ... rest of your callback logic
  };

  return (
    <div className="fitbit-callback-container">
      {/* Your existing JSX */}
    </div>
  );
};