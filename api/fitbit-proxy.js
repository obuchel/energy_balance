// api/fitbit-proxy.js - Vercel Serverless Function
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extract the Fitbit API path from the request
    const { path } = req.query;
    
    if (!path) {
      return res.status(400).json({ error: 'Missing path parameter' });
    }

    // Get authorization header from request
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    // Construct Fitbit API URL
    const fitbitUrl = `https://api.fitbit.com/${Array.isArray(path) ? path.join('/') : path}`;
    
    console.log('Proxying request to:', fitbitUrl);

    // Forward request to Fitbit API
   /* const response = await fetch(fitbitUrl, {
      method: req.method,
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    });*/
    const response = await fetch('/api/fitbit-proxy', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
          'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          path: '1/user/-/activities/date/2025-06-16.json',
          accessToken: accessToken
      })
  });
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Proxy server error', 
      message: error.message 
    });
  }
}