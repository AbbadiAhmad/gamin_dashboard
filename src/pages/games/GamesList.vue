<template>
  <div>
    <base-dialog :show="!!error" title="An error occurred!" @close="handleError">
      <p>{{ error }}</p>
    </base-dialog>
    <section>
      <base-card>
        <div class="controls">
          <base-button mode="outline" @click="loadGames(true)">Refresh</base-button>
          <base-button v-if="isAdmin && !isLoading" link to="/games/new">Add New Game</base-button>
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
          ></game-item>
        </ul>
        <h3 v-else>No games found.</h3>
      </base-card>
    </section>
  </div>
</template>

<script>
import GameItem from '../../components/games/GameItem.vue';

export default {
  components: {
    GameItem
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
