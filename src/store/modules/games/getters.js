export default {
  games(state) {
    return state.games;
  },
  hasGames(state) {
    return state.games && state.games.length > 0;
  },
  shouldUpdate(state) {
    const lastFetch = state.lastFetch;
    if (!lastFetch) {
      return true;
    }
    const currentTimeStamp = new Date().getTime();
    return (currentTimeStamp - lastFetch) / 1000 > 60; // More than 60 seconds
  },
  getGameById: (state) => (id) => {
    return state.games.find(game => game.id === id);
  },
  getGamesByGroupId: (state) => (groupId) => {
    return state.games.filter(game => game.gamingGroupId === groupId);
  }
};
