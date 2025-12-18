export default {
  groups(state) {
    return state.groups;
  },
  hasGroups(state) {
    return state.groups && state.groups.length > 0;
  },
  getGroupById: (state) => (groupId) => {
    return state.groups.find(group => group.id === groupId);
  },
  shouldUpdate(state) {
    const lastFetch = state.lastFetch;
    if (!lastFetch) {
      return true;
    }
    const currentTimeStamp = new Date().getTime();
    return (currentTimeStamp - lastFetch) / 1000 > 60;
  }
};
