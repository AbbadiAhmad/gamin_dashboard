export default {
  setTeams(state, payload) {
    state.teams = payload;
  },
  setFetchTimestamp(state) {
    state.lastFetch = new Date().getTime();
  },
  addTeam(state, payload) {
    state.teams.push(payload);
  },
  updateTeam(state, payload) {
    const index = state.teams.findIndex(team => team.id === payload.id);
    if (index !== -1) {
      state.teams[index] = payload;
    }
  },
  deleteTeam(state, teamId) {
    state.teams = state.teams.filter(team => team.id !== teamId);
  }
};
