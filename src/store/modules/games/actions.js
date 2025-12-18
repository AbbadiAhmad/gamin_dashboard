const API_URL = 'http://localhost:3000';

export default {
  async loadGames(context, payload) {
    if (!payload || (!payload.forceRefresh && !context.getters.shouldUpdate)) {
      return;
    }

    const token = context.rootGetters['auth/token'];

    let url = `${API_URL}/games`;
    if (payload && payload.gamingGroupId) {
      url += `?gaming_group_id=${payload.gamingGroupId}`;
    }

    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.message || 'Failed to fetch games');
      console.error('Load games error:', data);
      throw error;
    }

    context.commit('setGames', data);
    context.commit('setFetchTimestamp');
  },

  async createGame(context, payload) {
    const token = context.rootGetters['auth/token'];
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create game');
    }

    // Reload games
    context.dispatch('loadGames', { forceRefresh: true });

    return data;
  },

  async updateGame(context, payload) {
    const token = context.rootGetters['auth/token'];
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/games/${payload.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update game');
    }

    // Reload games
    context.dispatch('loadGames', { forceRefresh: true });

    return data;
  },

  async deleteGame(context, payload) {
    const token = context.rootGetters['auth/token'];
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/games/${payload.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete game');
    }

    // Reload games
    context.dispatch('loadGames', { forceRefresh: true });

    return data;
  },

  async reorderGames(context, payload) {
    const token = context.rootGetters['auth/token'];
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/games/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to reorder games');
    }

    // Reload games to get updated order
    context.dispatch('loadGames', { forceRefresh: true });

    return data;
  }
};
