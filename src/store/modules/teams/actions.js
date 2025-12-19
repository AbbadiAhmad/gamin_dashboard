import { API_BASE_URL } from '../../../config.js';

const API_URL = API_BASE_URL;

export default {
  async loadTeams(context, payload) {
    if (!payload || !payload.forceRefresh) {
      const lastFetch = context.state.lastFetch;
      if (lastFetch) {
        const currentTimeStamp = new Date().getTime();
        if (currentTimeStamp - lastFetch < 60000) {
          return;
        }
      }
    }

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/teams`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const responseData = await response.json();

    if (!response.ok) {
      const error = new Error(responseData.message || 'Failed to fetch teams.');
      throw error;
    }

    context.commit('setTeams', responseData);
    context.commit('setFetchTimestamp');
  },

  async createTeam(context, payload) {
    const token = localStorage.getItem('token');
    const teamData = {
      name: payload.name,
      description: payload.description
    };

    const response = await fetch(`${API_URL}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(teamData)
    });

    const responseData = await response.json();

    if (!response.ok) {
      const error = new Error(responseData.message || 'Failed to create team.');
      throw error;
    }

    context.commit('addTeam', responseData);
  },

  async updateTeam(context, payload) {
    const token = localStorage.getItem('token');
    const teamData = {
      name: payload.name,
      description: payload.description
    };

    const response = await fetch(`${API_URL}/teams/${payload.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(teamData)
    });

    const responseData = await response.json();

    if (!response.ok) {
      const error = new Error(responseData.message || 'Failed to update team.');
      throw error;
    }

    context.commit('updateTeam', responseData);
  },

  async deleteTeam(context, payload) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/teams/${payload.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const responseData = await response.json();
      const error = new Error(responseData.message || 'Failed to delete team.');
      throw error;
    }

    context.commit('deleteTeam', payload.id);
  },

  async addTeamToGroup(context, payload) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/gaming-groups/${payload.groupId}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        teamId: payload.teamId,
        score: payload.score || 0
      })
    });

    const responseData = await response.json();

    if (!response.ok) {
      const error = new Error(responseData.message || 'Failed to add team to group.');
      throw error;
    }

    return responseData;
  },

  async removeTeamFromGroup(context, payload) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/gaming-groups/${payload.groupId}/teams/${payload.teamId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const responseData = await response.json();
      const error = new Error(responseData.message || 'Failed to remove team from group.');
      throw error;
    }
  },

  async loadGroupTeams(context, payload) {
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/gaming-groups/${payload.groupId}/teams`, {
      headers
    });

    const responseData = await response.json();

    if (!response.ok) {
      const error = new Error(responseData.message || 'Failed to fetch group teams.');
      throw error;
    }

    return responseData;
  }
};
