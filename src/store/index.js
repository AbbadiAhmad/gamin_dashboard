import { createStore } from 'vuex';

import coachesModule from './modules/coaches/index.js';
import requestsModule from './modules/requests/index.js';
import authModule from './modules/auth/index.js';
import gamingGroupsModule from './modules/gaming-groups/index.js';
import gamesModule from './modules/games/index.js';
import teamsModule from './modules/teams/index.js';

const store = createStore({
  modules: {
    coaches: coachesModule,
    requests: requestsModule,
    auth: authModule,
    gamingGroups: gamingGroupsModule,
    games: gamesModule,
    teams: teamsModule
  },
  state() {
    return {
      userId: 'c3'
    };
  },
  getters: {
    userId(state) {
      return state.userId;
    }
  }
});

export default store;