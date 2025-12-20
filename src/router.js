import { createRouter, createWebHistory } from 'vue-router';

// Eager load: Login and Dashboard pages (for fast initial load)
import UserAuth from './pages/auth/UserAuth.vue';
import GameDashboard from './pages/dashboard/GameDashboard.vue';
import GamingGroupsDashboard from './pages/dashboard/GamingGroupsDashboard.vue';
import LiveGame from './pages/dashboard/LiveGame.vue';

// Lazy load: All other pages
const UserSetup = () => import('./pages/auth/UserSetup.vue');
const GamingGroupsList = () => import('./pages/gaming-groups/GamingGroupsList.vue');
const GamingGroupDetail = () => import('./pages/gaming-groups/GamingGroupDetail.vue');
const GamingGroupForm = () => import('./pages/gaming-groups/GamingGroupForm.vue');
const GamesList = () => import('./pages/games/GamesList.vue');
const GameForm = () => import('./pages/games/GameForm.vue');
const GameEvaluation = () => import('./pages/games/GameEvaluation.vue');
const TimeGameEvaluation = () => import('./pages/games/TimeGameEvaluation.vue');
const TeamsList = () => import('./pages/teams/TeamsList.vue');
const TeamForm = () => import('./pages/teams/TeamForm.vue');
const TeamBoard = () => import('./pages/teamboard/TeamBoard.vue');
const AudienceDashboard = () => import('./pages/audience/AudienceDashboard.vue');
const NotFound = () => import('./pages/NotFound.vue');


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
    {
      path: '/games/:id',
      component: GameEvaluation,
      props: true,
      children: [
        { path: 'time', component: TimeGameEvaluation, props: true }
      ]
    },
    { path: '/games/:id/edit', component: GameForm },
    { path: '/teams', component: TeamsList },
    { path: '/teams/new', component: TeamForm },
    { path: '/teams/:id/edit', component: TeamForm },
    { path: '/teamboard', component: TeamBoard },
    { path: '/teamboard/:code', component: TeamBoard, props: true },
    { path: '/audience', component: AudienceDashboard },
    { path: '/audience/:id', component: AudienceDashboard, props: true },
    { path: '/:notFound(.*)', component: NotFound }
  ]
});

export default router;
