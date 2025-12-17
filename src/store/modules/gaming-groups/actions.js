const API_URL = 'http://localhost:3000';

export default {
  async loadGroups(context, payload) {
    if (!payload || !payload.forceRefresh) {
      if (!context.getters.shouldUpdate) {
        return;
      }
    }

    const token = context.rootGetters['auth/token'];
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/gaming-groups`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch gaming groups');
    }

    context.commit('setGroups', data);
    context.commit('setFetchTimestamp');
  },

  async addGroup(context, payload) {
    const token = context.rootGetters['auth/token'];
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/gaming-groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: payload.name,
        description: payload.description
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to add gaming group');
    }

    context.commit('addGroup', data);
  },

  async updateGroup(context, payload) {
    const token = context.rootGetters['auth/token'];
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/gaming-groups/${payload.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: payload.name,
        description: payload.description
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update gaming group');
    }

    context.commit('updateGroup', data);
  },

  async deleteGroup(context, groupId) {
    const token = context.rootGetters['auth/token'];
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/gaming-groups/${groupId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete gaming group');
    }

    context.commit('deleteGroup', groupId);
  }
};
