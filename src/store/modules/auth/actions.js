const API_URL = 'http://localhost:3000';

let logoutTimer;

export default {
  async login(context, payload) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: payload.email,
        password: payload.password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.message || 'Failed to authenticate';
      throw new Error(errorMessage);
    }

    // Calculate expiration time (2 hours from now)
    const expiresIn = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    const expirationDate = new Date().getTime() + expiresIn;

    context.commit('setUser', {
      token: data.token,
      userId: data.user.id,
      userName: data.user.name,
      userEmail: data.user.email,
      userRole: data.user.role,
      tokenExpiration: expirationDate
    });

    // Set auto-logout timer
    context.dispatch('setAutoLogout', expiresIn);

    return data;
  },

  async signup(context, payload) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        password: payload.password,
        role: payload.role || 'evaluator'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to register');
    }

    // Calculate expiration time (2 hours from now)
    const expiresIn = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    const expirationDate = new Date().getTime() + expiresIn;

    context.commit('setUser', {
      token: data.token,
      userId: data.user.id,
      userName: data.user.name,
      userEmail: data.user.email,
      userRole: data.user.role,
      tokenExpiration: expirationDate
    });

    // Set auto-logout timer
    context.dispatch('setAutoLogout', expiresIn);

    return data;
  },

  logout(context) {
    context.commit('clearAuth');

    if (logoutTimer) {
      clearTimeout(logoutTimer);
    }
  },

  setAutoLogout(context, duration) {
    if (logoutTimer) {
      clearTimeout(logoutTimer);
    }

    logoutTimer = setTimeout(() => {
      context.dispatch('logout');
    }, duration);
  },

  tryAutoLogin(context) {
    const token = localStorage.getItem('token');
    const tokenExpiration = localStorage.getItem('tokenExpiration');

    if (!token || !tokenExpiration) {
      return;
    }

    const expiresIn = +tokenExpiration - new Date().getTime();

    if (expiresIn < 0) {
      // Token expired
      context.dispatch('logout');
      return;
    }

    // Token still valid, restore user state
    const userId = localStorage.getItem('userId');
    const userName = localStorage.getItem('userName');
    const userEmail = localStorage.getItem('userEmail');
    const userRole = localStorage.getItem('userRole');

    context.commit('setUser', {
      token,
      userId,
      userName,
      userEmail,
      userRole,
      tokenExpiration
    });

    // Set auto-logout for remaining time
    context.dispatch('setAutoLogout', expiresIn);
  }
};
