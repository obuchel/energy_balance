const validateAuthHeader = (event) => {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  
  return authHeader.replace('Bearer ', '');
};

const validateRequestBody = (event, requiredFields = []) => {
  if (!event.body) {
    throw new Error('Request body is required');
  }
  
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
  
  for (const field of requiredFields) {
    if (!body[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  return body;
};

module.exports = {
  validateAuthHeader,
  validateRequestBody
};
