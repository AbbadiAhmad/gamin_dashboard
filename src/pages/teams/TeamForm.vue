<template>
  <section>
    <base-card>
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

export default {
  components: {
    TeamForm,
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
        this.$router.replace('/teams');
      } catch (error) {
        console.error('Error saving team:', error);
        alert(error.message || 'Failed to save team');
      }
    }
  }
};
</script>
