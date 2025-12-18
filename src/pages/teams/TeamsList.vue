<template>
  <div>
    <base-dialog :show="!!error" title="An error occurred!" @close="handleError">
      <p>{{ error }}</p>
    </base-dialog>
    <section>
      <base-card>
        <div class="controls">
          <base-button mode="outline" @click="loadTeams(true)">Refresh</base-button>
          <base-button v-if="isAdmin && !isLoading" link to="/teams/new">Add New Team</base-button>
        </div>
        <div v-if="isLoading">
          <base-spinner></base-spinner>
        </div>
        <ul v-else-if="hasTeams">
          <team-item
            v-for="team in teams"
            :key="team.id"
            :id="team.id"
            :name="team.name"
            :description="team.description"
            @delete="handleDelete"
          ></team-item>
        </ul>
        <h3 v-else>No teams found.</h3>
      </base-card>
    </section>
  </div>
</template>

<script>
import TeamItem from '../../components/teams/TeamItem.vue';

export default {
  components: {
    TeamItem
  },
  data() {
    return {
      isLoading: false,
      error: null
    };
  },
  computed: {
    isAdmin() {
      return this.$store.getters['auth/userRole'] === 'administrator';
    },
    teams() {
      return this.$store.getters['teams/teams'];
    },
    hasTeams() {
      return !this.isLoading && this.teams.length > 0;
    }
  },
  created() {
    this.loadTeams();
  },
  methods: {
    async loadTeams(refresh = false) {
      this.isLoading = true;
      try {
        await this.$store.dispatch('teams/loadTeams', {
          forceRefresh: refresh
        });
      } catch (error) {
        this.error = error.message || 'Something went wrong!';
      }
      this.isLoading = false;
    },
    async handleDelete(teamId) {
      if (!confirm('Are you sure you want to delete this team?')) {
        return;
      }

      try {
        await this.$store.dispatch('teams/deleteTeam', { id: teamId });
        await this.loadTeams(true);
      } catch (error) {
        this.error = error.message || 'Failed to delete team';
      }
    },
    handleError() {
      this.error = null;
    }
  }
};
</script>

<style scoped>
ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.controls {
  display: flex;
  justify-content: space-between;
}
</style>
