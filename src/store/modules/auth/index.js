import mutations from './mutations.js';
import actions from './actions.js';
import getters from './getters.js';

export default {
  namespaced: true,
  state() {
    return {
      token: localStorage.getItem('token') || null,
      userId: localStorage.getItem('userId') || null,
      userName: localStorage.getItem('userName') || null,
      userEmail: localStorage.getItem('userEmail') || null,
      userRole: localStorage.getItem('userRole') || null,
      tokenExpiration: localStorage.getItem('tokenExpiration') || null,
    };
  },
  mutations,
  actions,
  getters
};
