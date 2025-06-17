const { corsHeaders } = require('./cors');

const createResponse = (statusCode, data, isError = false) => {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(isError ? { error: data } : data)
  };
};

const createSuccessResponse = (data) => createResponse(200, data);
const createErrorResponse = (statusCode, message) => createResponse(statusCode, message, true);

module.exports = {
  createResponse,
  createSuccessResponse,
  createErrorResponse
};
