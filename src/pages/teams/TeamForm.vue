<template>
  <section>
    <base-card>
      <the-breadcrumb :crumbs="[
        { label: 'Teams', to: '/teams' },
        { label: isEdit ? 'Edit Team' : 'Add Team' }
      ]"></the-breadcrumb>
      <h2>{{ isEdit ? 'Edit' : 'Add' }} Team</h2>
      <team-form
        v-if="!isLoading"
        :is-edit="isEdit"
        :team-data="teamData"
        @save-data="saveData"
      ></team-form>
      <base-spinner v-else></base-spinner>
    </base-card>
  </section>
</template>

<script>
import TeamForm from '../../components/teams/TeamForm.vue';
import TheBreadcrumb from '../../components/ui/TheBreadcrumb.vue';

export default {
  components: {
    TeamForm,
    TheBreadcrumb
  },
  data() {
    return {
      teamData: null,
      isEdit: false,
      isLoading: true,
    };
  },
  async created() {
    const teamId = this.$route.params.id;

    if (teamId) {
      this.isEdit = true;
      try {
        await this.$store.dispatch('teams/loadTeams', { forceRefresh: true });
        const team = this.$store.getters['teams/getTeamById'](parseInt(teamId));
        if (team) {
          this.teamData = { ...team };
        } else {
          this.$router.replace('/teams');
        }
      } catch (error) {
        this.$router.replace('/teams');
      }
    }
    this.isLoading = false;
  },
  methods: {
    async saveData(data) {
      try {
        if (this.isEdit) {
          await this.$store.dispatch('teams/updateTeam', {
            id: this.$route.params.id,
            ...data
          });
        } else {
          await this.$store.dispatch('teams/createTeam', data);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.$router.replace('/teams');
      } catch (error) {
        console.error('Error saving team:', error);
        alert(error.message || 'Failed to save team');
      }
    }
  }
};
</script>
