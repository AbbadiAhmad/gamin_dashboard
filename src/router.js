import { createRouter, createWebHistory } from 'vue-router';

import UserAuth from './pages/auth/UserAuth.vue';
import UserSetup from './pages/auth/UserSetup.vue';
import GamingGroupsList from './pages/gaming-groups/GamingGroupsList.vue';
import GamingGroupDetail from './pages/gaming-groups/GamingGroupDetail.vue';
import GamingGroupForm from './pages/gaming-groups/GamingGroupForm.vue';
import GamesList from './pages/games/GamesList.vue';
import GameForm from './pages/games/GameForm.vue';
import GameEvaluation from './pages/games/GameEvaluation.vue';
import TeamsList from './pages/teams/TeamsList.vue';
import TeamForm from './pages/teams/TeamForm.vue';
import GameDashboard from './pages/dashboard/DashboardHome.vue';
import LiveGame from './pages/dashboard/LiveGame.vue';
import GamingGroupsDashboard from './pages/dashboard/GamingGroupsDashboard.vue';
import NotFound from './pages/NotFound.vue';


const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard/gaming-groups' },
    { path: '/dashboard', component: GameDashboard },
    { path: '/dashboard/gaming-groups', component: GamingGroupsDashboard },
    { path: '/dashboard/live/:id', component: LiveGame, props: true },
    { path: '/auth', component: UserAuth },
    { path: '/setup', component: UserSetup },
    { path: '/gaming-groups', component: GamingGroupsList },
    { path: '/gaming-groups/new', component: GamingGroupForm },
    { path: '/gaming-groups/:id', component: GamingGroupDetail, props: true },
    { path: '/gaming-groups/:id/edit', component: GamingGroupForm },
    { path: '/games', component: GamesList },
    { path: '/games/new', component: GameForm },
    { path: '/games/:id', component: GameEvaluation, props: true },
    { path: '/games/:id/edit', component: GameForm },
    { path: '/teams', component: TeamsList },
    { path: '/teams/new', component: TeamForm },
    { path: '/teams/:id/edit', component: TeamForm },
    { path: '/:notFound(.*)', component: NotFound }
  ]
});

export default router;
