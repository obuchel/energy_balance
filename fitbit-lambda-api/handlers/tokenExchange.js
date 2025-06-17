const { exchangeCodeForTokens } = require('../lib/fitbitApi');
const { createSuccessResponse, createErrorResponse } = require('../lib/response');
const { validateRequestBody } = require('../lib/validation');

exports.handler = async (event) => {
  console.log('🔄 POST /token-exchange - Request received');
  
  try {
    // Validate request body
    const { code, redirect_uri } = validateRequestBody(event, ['code', 'redirect_uri']);
    console.log('✅ Request body validated');
    
    // Exchange authorization code for tokens
    console.log('🔄 Exchanging code for tokens...');
    const tokenData = await exchangeCodeForTokens(code, redirect_uri);
    
    console.log('✅ Code exchanged for tokens successfully');
    
    return createSuccessResponse(tokenData);
    
  } catch (error) {
    console.error('❌ Error in POST /token-exchange:', error);
    
    if (error.message.includes('required') || error.message.includes('Invalid JSON')) {
      return createErrorResponse(400, error.message);
    }
    
    if (error.message.includes('Token exchange failed')) {
      return createErrorResponse(400, 'Invalid authorization code');
    }
    
    return createErrorResponse(500, error.message);
  }
};
