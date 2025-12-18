export default {
  setGames(state, payload) {
    state.games = payload;
  },
  setFetchTimestamp(state) {
    state.lastFetch = new Date().getTime();
  }
};
