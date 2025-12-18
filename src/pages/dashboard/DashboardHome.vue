<template>
  <div>
    <base-dialog :show="!!error" title="An error occurred!" @close="handleError">
      <p>{{ error }}</p>
    </base-dialog>
    <section>
      <base-card>
        <h1>Live Games Dashboard</h1>
        <p class="subtitle">Watch running games in real-time</p>

        <div v-if="isLoading" class="loading">
          <base-spinner></base-spinner>
        </div>

        <div v-else-if="runningGames.length > 0" class="games-grid">
          <div
            v-for="game in runningGames"
            :key="game.id"
            class="game-card"
            @click="goToLiveGame(game.id)"
          >
            <div class="game-card-header">
              <h3>{{ game.name }}</h3>
              <span class="live-badge">LIVE</span>
            </div>
            <p class="game-description">{{ game.description }}</p>
            <div class="game-meta">
              <base-badge :type="game.gamingGroupName" :title="game.gamingGroupName"></base-badge>
              <span class="points-range">{{ game.minimumPoint }} - {{ game.maximumPoint }} pts</span>
            </div>
          </div>
        </div>

        <div v-else class="no-games">
          <h3>No games are currently running</h3>
          <p>Check back later for live games!</p>
        </div>
      </base-card>
    </section>
  </div>
</template>

<script>
export default {
  data() {
    return {
      isLoading: false,
      error: null,
      refreshInterval: null
    };
  },
  computed: {
    runningGames() {
      const games = this.$store.getters['games/games'];
      return games.filter(game => game.status === 'running');
    }
  },
  async created() {
    await this.loadGames();
    // Auto-refresh every 10 seconds
    this.refreshInterval = setInterval(() => {
      this.loadGames(true);
    }, 10000);
  },
  beforeUnmount() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  },
  methods: {
    async loadGames(silent = false) {
      if (!silent) {
        this.isLoading = true;
      }
      try {
        await this.$store.dispatch('games/loadGames', { forceRefresh: true });
      } catch (error) {
        this.error = error.message || 'Failed to load games';
      }
      this.isLoading = false;
    },
    goToLiveGame(gameId) {
      this.$router.push(`/dashboard/live/${gameId}`);
    },
    handleError() {
      this.error = null;
    }
  }
};
</script>

<style scoped>
h1 {
  font-size: 2.5rem;
  margin: 0 0 0.5rem 0;
  color: #3d008d;
}

.subtitle {
  font-size: 1.2rem;
  color: #666;
  margin: 0 0 2rem 0;
}

.loading {
  text-align: center;
  padding: 3rem;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.game-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.game-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.2);
}

.game-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.game-card-header h3 {
  margin: 0;
  font-size: 1.5rem;
}

.live-badge {
  background: #ff4444;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: bold;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.game-description {
  margin: 0 0 1rem 0;
  opacity: 0.9;
  line-height: 1.5;
}

.game-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
}

.points-range {
  font-weight: 500;
  opacity: 0.9;
}

.no-games {
  text-align: center;
  padding: 4rem 2rem;
  color: #666;
}

.no-games h3 {
  font-size: 1.5rem;
  margin: 0 0 1rem 0;
}

.no-games p {
  font-size: 1.1rem;
  margin: 0;
}
</style>
