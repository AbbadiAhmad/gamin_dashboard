<template>
  <div>
    <base-dialog :show="!!error" title="An error occurred!" @close="handleError">
      <p>{{ error }}</p>
    </base-dialog>
    <section>
      <base-card>
        <the-breadcrumb :crumbs="[{ label: 'Game Dashboard' }]"></the-breadcrumb>
        <h1>Games Dashboard</h1>
        <p class="subtitle">All games - click status badges to filter</p>

        <div class="status-filters">
          <button
            class="filter-badge running-filter"
            :class="{ active: statusFilters.running }"
            @click="toggleStatusFilter('running')"
          >
            <span class="live-badge">LIVE</span>
            <span class="count">{{ getGameCountByStatus('running') }}</span>
          </button>
          <button
            class="filter-badge finished-filter"
            :class="{ active: statusFilters.past }"
            @click="toggleStatusFilter('past')"
          >
            <span class="finished-badge">FINISHED</span>
            <span class="count">{{ getGameCountByStatus('past') }}</span>
          </button>
          <button
            class="filter-badge coming-filter"
            :class="{ active: statusFilters.coming }"
            @click="toggleStatusFilter('coming')"
          >
            <span class="upcoming-badge">UPCOMING</span>
            <span class="count">{{ getGameCountByStatus('coming') }}</span>
          </button>
        </div>

        <div v-if="isLoading" class="loading">
          <base-spinner></base-spinner>
        </div>

        <div v-else-if="filteredGames.length > 0" class="games-grid">
          <div
            v-for="game in filteredGames"
            :key="game.id"
            class="game-card"
            :class="getGameCardClass(game.status)"
            @click="goToLiveGame(game.id)"
          >
            <div class="game-card-header">
              <h3>{{ game.name }}</h3>
              <span v-if="game.status === 'running'" class="live-badge">LIVE</span>
              <span v-else-if="game.status === 'past'" class="finished-badge">FINISHED</span>
              <span v-else class="upcoming-badge">UPCOMING</span>
            </div>
            <p class="game-description">{{ game.description }}</p>
            <div class="game-meta">
              <base-badge :type="game.gamingGroupName" :title="game.gamingGroupName"></base-badge>
              <span class="points-range">{{ game.minimumPoint }} - {{ game.maximumPoint }} pts</span>
            </div>
          </div>
        </div>

        <div v-else class="no-games">
          <h3>No games found</h3>
          <p>{{ noGamesMessage }}</p>
        </div>
      </base-card>
    </section>
  </div>
</template>

<script>
import TheBreadcrumb from '../../components/ui/TheBreadcrumb.vue';

export default {
  components: {
    TheBreadcrumb
  },
  data() {
    return {
      isLoading: false,
      error: null,
      refreshInterval: null,
      statusFilters: {
        running: true,
        past: true,
        coming: true
      }
    };
  },
  computed: {
    allGames() {
      const games = this.$store.getters['games/games'];
      // Order by: 1st status (running > coming > past), 2nd gaming group name
      const statusOrder = { running: 1, coming: 2, past: 3 };
      return games.sort((a, b) => {
        // First sort by status
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;

        // Then sort by gaming group name
        return (a.gamingGroupName || '').localeCompare(b.gamingGroupName || '');
      });
    },
    filteredGames() {
      return this.allGames.filter(game => this.statusFilters[game.status]);
    },
    noGamesMessage() {
      const activeFiltersCount = Object.values(this.statusFilters)
        .filter(active => active).length;

      if (activeFiltersCount === 0) {
        return 'Please select at least one status filter above.';
      }

      const allGamesCount = this.allGames.length;
      if (allGamesCount === 0) {
        return 'No games available. Create some games to get started!';
      }

      return 'No games match the selected filters.';
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
    toggleStatusFilter(status) {
      this.statusFilters[status] = !this.statusFilters[status];
    },
    getGameCountByStatus(status) {
      return this.allGames.filter(game => game.status === status).length;
    },
    getGameCardClass(status) {
      if (status === 'past') return 'finished-game';
      if (status === 'coming') return 'upcoming-game';
      return '';
    },
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
  margin: 0 0 1.5rem 0;
}

.status-filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.filter-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 2px solid transparent;
  border-radius: 25px;
  background: #f5f5f5;
  cursor: pointer;
  transition: all 0.3s ease;
  font: inherit;
}

.filter-badge:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.filter-badge.active {
  border-color: #3d008d;
  background: white;
  box-shadow: 0 2px 8px rgba(61, 0, 141, 0.2);
}

.filter-badge .count {
  background: #3d008d;
  color: white;
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: bold;
  min-width: 24px;
  text-align: center;
}

.filter-badge.active .count {
  background: #f391e3;
  color: #3d008d;
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

.finished-badge {
  background: #4CAF50;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: bold;
}

.upcoming-badge {
  background: #FF9800;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: bold;
}

.finished-game {
  background: linear-gradient(135deg, #81C784 0%, #66BB6A 100%) !important;
  opacity: 0.9;
}

.upcoming-game {
  background: linear-gradient(135deg, #FFB74D 0%, #FFA726 100%) !important;
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

@media (max-width: 768px) {
  h1 {
    font-size: 2rem;
  }

  .subtitle {
    font-size: 1rem;
  }

  .status-filters {
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .filter-badge {
    padding: 0.5rem 0.75rem;
    font-size: 0.9rem;
  }

  .games-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .game-card {
    padding: 1.25rem;
  }

  .game-card-header h3 {
    font-size: 1.25rem;
  }

  .game-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .no-games {
    padding: 3rem 1rem;
  }
}

@media (max-width: 480px) {
  h1 {
    font-size: 1.5rem;
  }

  .subtitle {
    font-size: 0.9rem;
  }

  .status-filters {
    flex-direction: column;
    gap: 0.5rem;
  }

  .filter-badge {
    width: 100%;
    justify-content: space-between;
    padding: 0.75rem 1rem;
  }

  .games-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .game-card {
    padding: 1rem;
  }

  .game-card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .game-card-header h3 {
    font-size: 1.1rem;
  }

  .no-games {
    padding: 2rem 0.5rem;
  }

  .no-games h3 {
    font-size: 1.25rem;
  }

  .no-games p {
    font-size: 1rem;
  }
}
</style>
