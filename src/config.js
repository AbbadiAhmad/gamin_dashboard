// API configuration
// Automatically detect the API URL based on the current environment
const getApiBaseUrl = () => {
  // 1. Check for environment variable (highest priority)
  if (process.env.VUE_APP_API_URL) {
    return process.env.VUE_APP_API_URL;
  }

  // 2. If running in production (deployed), use relative path to same domain
  if (process.env.NODE_ENV === 'production') {
    // Use the same host but port 3000
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:3000`;
  }

  // 3. Default to localhost for development
  return 'http://localhost:3000';
};

export const API_BASE_URL = getApiBaseUrl();

// Socket.io URL (same as API but for WebSocket connections)
export const SOCKET_URL = getApiBaseUrl();
