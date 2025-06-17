// handlers/fitbitData.js - GET /fitbit endpoint
const { fetchFitbitData } = require('../lib/fitbitApi');
const { createSuccessResponse, createErrorResponse } = require('../lib/response');
const { validateAuthHeader } = require('../lib/validation');

exports.handler = async (event) => {
  console.log('📡 GET /fitbit - Request received');
  console.log('Headers:', JSON.stringify(event.headers, null, 2));
  
  try {
    // Validate and extract access token from Authorization header
    const accessToken = validateAuthHeader(event);
    console.log('✅ Access token validated');
    
    // Fetch data from Fitbit API
    console.log('📡 Fetching data from Fitbit API...');
    const fitbitData = await fetchFitbitData(accessToken);
    
    console.log('✅ Fitbit data fetched successfully');
    console.log('Data:', JSON.stringify(fitbitData, null, 2));
    
    return createSuccessResponse(fitbitData);
    
  } catch (error) {
    console.error('❌ Error in GET /fitbit:', error);
    
    // Handle specific error cases
    if (error.message.includes('Authorization') || error.message.includes('Missing') || error.message.includes('invalid')) {
      return createErrorResponse(401, error.message);
    }
    
    if (error.message.includes('Fitbit API error')) {
      return createErrorResponse(502, `Fitbit API error: ${error.message}`);
    }
    
    return createErrorResponse(500, error.message);
  }
};

