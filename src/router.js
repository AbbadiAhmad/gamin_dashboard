import { createRouter, createWebHistory } from 'vue-router';

import CoachDetail from './pages/coaches/CoachDetail.vue';
import CoachesList from './pages/coaches/CoachesList.vue';
import CoachRegistation from './pages/coaches/CoachRegistration.vue';
import ContactCoach from './pages/requests/ContactCoach.vue';
import RequestsReceived from './pages/requests/RequestsReceived.vue';
import UserAuth from './pages/auth/UserAuth.vue';
import UserSetup from './pages/auth/UserSetup.vue';
import GamingGroupsList from './pages/gaming-groups/GamingGroupsList.vue';
import GamingGroupForm from './pages/gaming-groups/GamingGroupForm.vue';
import NotFound from './pages/NotFound.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/coaches' },
    { path: '/coaches', component: CoachesList },
    {
      path: '/coaches/:id',
      component: CoachDetail,
      props: true,
      children: [
        { path: 'contact', component: ContactCoach } // /coaches/c1/contact
      ]
    },
    { path: '/register', component: CoachRegistation },
    { path: '/requests', component: RequestsReceived },
    { path: '/auth', component: UserAuth },
    { path: '/setup', component: UserSetup },
    { path: '/gaming-groups', component: GamingGroupsList },
    { path: '/gaming-groups/new', component: GamingGroupForm },
    { path: '/gaming-groups/:id/edit', component: GamingGroupForm },
    { path: '/:notFound(.*)', component: NotFound }
  ]
});

export default router;
