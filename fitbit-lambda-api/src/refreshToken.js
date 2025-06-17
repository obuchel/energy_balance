exports.handler = async (event) => {
  try {
    const { refresh_token } = JSON.parse(event.body);
    
    // Your token refresh logic here
    const tokenData = await refreshFitbitToken(refresh_token);
    
    return {
      statusCode: 200,
      headers: corsHeaders, // ← ADD THIS
      body: JSON.stringify(tokenData)
    };
  } catch (error) {
    console.error('Error refreshing token:', error);
    
    return {
      statusCode: 400,
      headers: corsHeaders, // ← ADD THIS TO ERROR RESPONSES TOO
      body: JSON.stringify({
        error: 'Failed to refresh token',
        message: error.message
      })
    };
  }
};
