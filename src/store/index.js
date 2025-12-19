import { createStore } from 'vuex';

//import coachesModule from './modules/coaches/index.js';
//import requestsModule from './modules/requests/index.js';
import authModule from './modules/auth/index.js';
import gamingGroupsModule from './modules/gaming-groups/index.js';
import gamesModule from './modules/games/index.js';
import teamsModule from './modules/teams/index.js';

const store = createStore({
  modules: {
  //  coaches: coachesModule,
  //  requests: requestsModule,
    auth: authModule,
    gamingGroups: gamingGroupsModule,
    games: gamesModule,
    teams: teamsModule
  },
  state() {
    return {
      userId: 'c3',
      adminModeEnabled: false
    };
  },
  getters: {
    userId(state) {
      return state.userId;
    },
    adminModeEnabled(state) {
      return state.adminModeEnabled;
    }
  },
  mutations: {
    setAdminMode(state, enabled) {
      state.adminModeEnabled = enabled;
    }
  },
  actions: {
    toggleAdminMode({ commit, state }) {
      commit('setAdminMode', !state.adminModeEnabled);
    },
    setAdminMode({ commit }, enabled) {
      commit('setAdminMode', enabled);
    }
  }
});

export default store;