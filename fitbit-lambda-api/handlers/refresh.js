const { refreshFitbitToken } = require('../lib/fitbitApi');
const { createSuccessResponse, createErrorResponse } = require('../lib/response');
const { validateRequestBody } = require('../lib/validation');

exports.handler = async (event) => {
  console.log('🔄 POST /refresh - Request received');
  console.log('Body:', event.body);
  
  try {
    // Validate request body and extract refresh_token
    const { refresh_token } = validateRequestBody(event, ['refresh_token']);
    console.log('✅ Request body validated');
    
    // Refresh the token using Fitbit API
    console.log('🔄 Refreshing Fitbit token...');
    const tokenData = await refreshFitbitToken(refresh_token);
    
    console.log('✅ Token refreshed successfully');
    console.log('New token data:', {
      access_token: tokenData.access_token ? 'PRESENT' : 'MISSING',
      refresh_token: tokenData.refresh_token ? 'PRESENT' : 'MISSING',
      expires_in: tokenData.expires_in
    });
    
    return createSuccessResponse(tokenData);
    
  } catch (error) {
    console.error('❌ Error in POST /refresh:', error);
    
    // Handle specific error cases
    if (error.message.includes('required') || error.message.includes('Invalid JSON')) {
      return createErrorResponse(400, error.message);
    }
    
    if (error.message.includes('Token refresh failed')) {
      return createErrorResponse(401, 'Invalid or expired refresh token');
    }
    
    if (error.message.includes('configured')) {
      return createErrorResponse(500, 'Server configuration error');
    }
    
    return createErrorResponse(500, error.message);
  }
};
