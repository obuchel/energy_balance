const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,OPTIONS,POST,PUT'
};

exports.handler = async (event) => {
  try {
    // Your existing Fitbit data fetching logic here
    const fitbitData = await fetchFitbitData(event);
    
    return {
      statusCode: 200,
      headers: corsHeaders, // ← ADD THIS
      body: JSON.stringify(fitbitData)
    };
  } catch (error) {
    console.error('Error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders, // ← ADD THIS TO ERROR RESPONSES TOO
      body: JSON.stringify({
        error: 'Failed to fetch Fitbit data',
        message: error.message
      })
    };
  }
};
