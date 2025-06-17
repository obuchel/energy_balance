// fitbit-proxy-server.js
// Simple Express server to proxy Fitbit API calls and avoid CORS

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // npm install node-fetch@2

const app = express();
const PORT = 3001;

// Enable CORS for your React app
app.use(cors({
  origin: 'http://localhost:64556', // Your React app URL
  credentials: true
}));

app.use(express.json());

// Simple catch-all route for Fitbit API proxying
app.use('/api/fitbit', async (req, res) => {
  try {
    // Remove /api/fitbit from the path to get the actual Fitbit API path
    const fitbitApiPath = req.path.replace('/api/fitbit', '');
    const fitbitUrl = `https://api.fitbit.com${fitbitApiPath}`;
    
    // Get the Authorization header from the request
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    console.log(`📡 Proxying ${req.method} request to: ${fitbitUrl}`);

    // Make the request to Fitbit API
    const fitbitResponse = await fetch(fitbitUrl, {
      method: req.method,
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    const data = await fitbitResponse.json();

    if (!fitbitResponse.ok) {
      console.error('❌ Fitbit API error:', data);
      return res.status(fitbitResponse.status).json(data);
    }

    console.log('✅ Successfully fetched data from Fitbit');
    res.json(data);

  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Fitbit proxy server is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Fitbit proxy server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying Fitbit API calls to avoid CORS issues`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

// Expected usage:
// GET /api/fitbit/1/user/-/activities/date/today.json
// GET /api/fitbit/1/user/-/activities/heart/date/today/1d.json