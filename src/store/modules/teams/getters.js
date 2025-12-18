export default {
  teams(state) {
    return state.teams;
  },
  hasTeams(state) {
    return state.teams && state.teams.length > 0;
  },
  getTeamById: (state) => (teamId) => {
    return state.teams.find(team => team.id === teamId);
  }
};
