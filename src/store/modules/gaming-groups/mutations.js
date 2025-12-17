export default {
  setGroups(state, payload) {
    state.groups = payload;
  },
  setFetchTimestamp(state) {
    state.lastFetch = new Date().getTime();
  },
  addGroup(state, payload) {
    state.groups.unshift(payload);
  },
  updateGroup(state, payload) {
    const index = state.groups.findIndex(g => g.id === payload.id);
    if (index !== -1) {
      state.groups[index] = payload;
    }
  },
  deleteGroup(state, groupId) {
    state.groups = state.groups.filter(g => g.id !== groupId);
  }
};
