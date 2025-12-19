<template>
  <div>
    <base-dialog :show="!!error" title="An error occurred!" @close="handleError">
      <p>{{ error }}</p>
    </base-dialog>
    <section>
      <base-card>
        <the-breadcrumb :crumbs="[{ label: 'Games' }]"></the-breadcrumb>
        <div class="controls">
          <base-button mode="outline" @click="loadGames(true)">Refresh</base-button>
          <base-button v-if="adminModeEnabled && !isLoading" link to="/games/new">Add New Game</base-button>
        </div>
        <div v-if="isLoading">
          <base-spinner></base-spinner>
        </div>
        <ul v-else-if="hasGames">
          <game-item
            v-for="game in games"
            :key="game.id"
            :id="game.id"
            :name="game.name"
            :description="game.description"
            :minimum-point="game.minimumPoint"
            :maximum-point="game.maximumPoint"
            :gaming-group-name="game.gamingGroupName"
            :status="game.status"
            @delete="handleDelete"
          ></game-item>
        </ul>
        <h3 v-else>No games found.</h3>
      </base-card>
    </section>
  </div>
</template>

<script>
import GameItem from '../../components/games/GameItem.vue';
import TheBreadcrumb from '../../components/ui/TheBreadcrumb.vue';

export default {
  components: {
    GameItem,
    TheBreadcrumb
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
    adminModeEnabled() {
      return this.$store.getters.adminModeEnabled;
    },
    games() {
      const gamingGroupId = this.$route.query.groupId;
      if (gamingGroupId) {
        return this.$store.getters['games/getGamesByGroupId'](parseInt(gamingGroupId));
      }
      return this.$store.getters['games/games'];
    },
    hasGames() {
      return !this.isLoading && this.games.length > 0;
    }
  },
  created() {
    this.loadGames();
  },
  methods: {
    async loadGames(refresh = false) {
      this.isLoading = true;
      try {
        const gamingGroupId = this.$route.query.groupId;
        await this.$store.dispatch('games/loadGames', {
          forceRefresh: refresh,
          gamingGroupId: gamingGroupId ? parseInt(gamingGroupId) : null
        });
      } catch (error) {
        this.error = error.message || 'Something went wrong!';
      }
      this.isLoading = false;
    },
    async handleDelete(gameId) {
      if (!confirm('Are you sure you want to delete this game?')) {
        return;
      }

      try {
        await this.$store.dispatch('games/deleteGame', { id: gameId });
        await this.loadGames(true);
      } catch (error) {
        this.error = error.message || 'Failed to delete game';
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
