// API configuration
// When running in Docker, use the backend service name
// When running locally, use localhost
export const API_BASE_URL = process.env.VUE_APP_API_URL || 'http://localhost:3000';
