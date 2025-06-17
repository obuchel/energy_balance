// api/health.js
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  res.status(200).json({ 
    status: 'OK', 
    message: 'Fitbit proxy server is running on Vercel',
    timestamp: new Date().toISOString()
  });
}