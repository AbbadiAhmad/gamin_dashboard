export default {
  setUser(state, payload) {
    state.token = payload.token;
    state.userId = payload.userId;
    state.userName = payload.userName;
    state.userEmail = payload.userEmail;
    state.userRole = payload.userRole;
    state.tokenExpiration = payload.tokenExpiration;

    // Store in localStorage
    localStorage.setItem('token', payload.token);
    localStorage.setItem('userId', payload.userId);
    localStorage.setItem('userName', payload.userName);
    localStorage.setItem('userEmail', payload.userEmail);
    localStorage.setItem('userRole', payload.userRole);
    localStorage.setItem('tokenExpiration', payload.tokenExpiration);
  },
  clearAuth(state) {
    state.token = null;
    state.userId = null;
    state.userName = null;
    state.userEmail = null;
    state.userRole = null;
    state.tokenExpiration = null;

    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    localStorage.removeItem('tokenExpiration');
  }
};
