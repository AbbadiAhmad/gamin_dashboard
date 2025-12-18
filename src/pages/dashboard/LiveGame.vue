<template>
  <div>
    <base-dialog :show="!!error" title="An error occurred!" @close="handleError">
      <p>{{ error }}</p>
    </base-dialog>
    <section v-if="!isLoading && game">
      <base-card>
        <div class="game-header">
          <div class="header-content">
            <base-button mode="flat" @click="goBack" class="back-button">← Back to Dashboard</base-button>
            <h1>{{ game.name }}</h1>
            <p class="game-description">{{ game.description }}</p>
            <div class="game-info">
              <base-badge :type="game.gamingGroupName" :title="game.gamingGroupName"></base-badge>
              <span class="live-indicator">
                <span class="live-dot"></span>
                LIVE
              </span>
            </div>
          </div>
        </div>

        <div class="leaderboard">
          <h2>Live Leaderboard</h2>
          <div v-if="rankedTeams.length > 0" class="teams-list">
            <transition-group name="team-move" tag="div">
              <div
                v-for="team in rankedTeams"
                :key="team.id"
                class="team-card"
                :class="`place-${team.place}`"
              >
                <div class="place-indicator">
                  <div class="place-number">{{ getPlaceDisplay(team.place) }}</div>
                  <div class="place-label">{{ getPlaceLabel(team.place) }}</div>
                </div>
                <div class="team-info">
                  <h3>{{ team.name }}</h3>
                  <p>{{ team.description }}</p>
                </div>
                <div class="score-display">
                  <span class="score-value">{{ team.score }}</span>
                  <span class="score-label">points</span>
                </div>
              </div>
            </transition-group>
          </div>
          <div v-else class="no-teams">
            <p>No teams have scores yet.</p>
          </div>
        </div>
      </base-card>
    </section>
    <base-spinner v-else></base-spinner>
  </div>
</template>

<script>
export default {
  props: ['id'],
  data() {
    return {
      isLoading: false,
      error: null,
      game: null,
      gameScores: [],
      groupTeams: [],
      refreshInterval: null,
      previousOrder: []
    };
  },
  computed: {
    rankedTeams() {
      if (!this.groupTeams.length || !this.gameScores.length) {
        return [];
      }

      // Combine team data with scores
      const teamsWithScores = this.groupTeams.map(team => {
        const scoreEntry = this.gameScores.find(s => s.teamId === team.id);
        return {
          ...team,
          score: scoreEntry ? scoreEntry.score : (this.game ? this.game.minimumPoint : 0)
        };
      });

      // Sort by score (highest first)
      teamsWithScores.sort((a, b) => b.score - a.score);

      // Assign places (teams with same score get same place)
      let currentPlace = 1;
      let previousScore = null;
      let teamsAtCurrentPlace = 0;

      teamsWithScores.forEach((team, index) => {
        if (previousScore !== null && team.score < previousScore) {
          currentPlace += teamsAtCurrentPlace;
          teamsAtCurrentPlace = 1;
        } else {
          teamsAtCurrentPlace++;
        }
        team.place = currentPlace;
        previousScore = team.score;
      });

      return teamsWithScores;
    }
  },
  async created() {
    await this.loadData();
    // Auto-refresh every 3 seconds for real-time updates
    this.refreshInterval = setInterval(() => {
      this.loadGameScores();
    }, 3000);
  },
  beforeUnmount() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  },
  methods: {
    async loadData() {
      this.isLoading = true;
      try {
        await this.$store.dispatch('games/loadGames', { forceRefresh: true });
        this.game = this.$store.getters['games/getGameById'](parseInt(this.id));

        if (!this.game) {
          this.$router.replace('/dashboard');
          return;
        }

        if (this.game.status !== 'running') {
          this.error = 'This game is not currently running';
          setTimeout(() => {
            this.$router.replace('/dashboard');
          }, 2000);
          return;
        }

        await this.loadGroupTeams();
        await this.loadGameScores();
      } catch (error) {
        this.error = error.message || 'Failed to load data';
      }
      this.isLoading = false;
    },
    async loadGroupTeams() {
      try {
        this.groupTeams = await this.$store.dispatch('teams/loadGroupTeams', {
          groupId: this.game.gamingGroupId
        });
      } catch (error) {
        console.error('Failed to load group teams:', error);
        this.groupTeams = [];
      }
    },
    async loadGameScores() {
      try {
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`http://localhost:3000/games/${this.id}/scores`, {
          headers
        });

        if (response.ok) {
          this.gameScores = await response.json();
        }
      } catch (error) {
        console.error('Failed to load game scores:', error);
      }
    },
    getPlaceDisplay(place) {
      return `#${place}`;
    },
    getPlaceLabel(place) {
      if (place === 1) return '1st Place';
      if (place === 2) return '2nd Place';
      if (place === 3) return '3rd Place';
      return `${place}th Place`;
    },
    goBack() {
      this.$router.push('/dashboard');
    },
    handleError() {
      this.error = null;
    }
  }
};
</script>

<style scoped>
.back-button {
  margin-bottom: 1rem;
}

.game-header {
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 1.5rem;
  margin-bottom: 2rem;
}

.header-content h1 {
  font-size: 2.5rem;
  margin: 0.5rem 0;
  color: #3d008d;
}

.game-description {
  color: #666;
  font-size: 1.1rem;
  margin: 0.5rem 0 1rem 0;
  line-height: 1.6;
}

.game-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #ff4444;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.9rem;
}

.live-dot {
  width: 10px;
  height: 10px;
  background: white;
  border-radius: 50%;
  animation: pulse-dot 2s infinite;
}

@keyframes pulse-dot {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

.leaderboard h2 {
  font-size: 2rem;
  margin: 0 0 1.5rem 0;
  color: #3d008d;
}

.teams-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.team-card {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  border: 2px solid #e0e0e0;
  transition: all 0.3s ease;
}

.team-move-enter-active,
.team-move-leave-active {
  transition: all 3s ease;
}

.team-move-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.team-move-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.team-move-move {
  transition: transform 3s ease;
}

.team-card.place-1 {
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  border-color: #FFD700;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
}

.team-card.place-2 {
  background: linear-gradient(135deg, #C0C0C0 0%, #A0A0A0 100%);
  border-color: #C0C0C0;
  box-shadow: 0 4px 15px rgba(192, 192, 192, 0.3);
}

.team-card.place-3 {
  background: linear-gradient(135deg, #CD7F32 0%, #B8733C 100%);
  border-color: #CD7F32;
  box-shadow: 0 4px 15px rgba(205, 127, 50, 0.3);
}

.place-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80px;
}

.place-number {
  font-size: 2rem;
  font-weight: bold;
  color: #3d008d;
}

.team-card.place-1 .place-number,
.team-card.place-2 .place-number,
.team-card.place-3 .place-number {
  color: white;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.place-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
}

.team-card.place-1 .place-label,
.team-card.place-2 .place-label,
.team-card.place-3 .place-label {
  color: rgba(255, 255, 255, 0.9);
}

.team-info {
  flex: 1;
}

.team-info h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  color: #333;
}

.team-card.place-1 .team-info h3,
.team-card.place-2 .team-info h3,
.team-card.place-3 .team-info h3 {
  color: white;
}

.team-info p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.team-card.place-1 .team-info p,
.team-card.place-2 .team-info p,
.team-card.place-3 .team-info p {
  color: rgba(255, 255, 255, 0.8);
}

.score-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: rgba(61, 0, 141, 0.1);
  border-radius: 8px;
  min-width: 100px;
}

.team-card.place-1 .score-display,
.team-card.place-2 .score-display,
.team-card.place-3 .score-display {
  background: rgba(255, 255, 255, 0.3);
}

.score-value {
  font-size: 2rem;
  font-weight: bold;
  color: #3d008d;
}

.team-card.place-1 .score-value,
.team-card.place-2 .score-value,
.team-card.place-3 .score-value {
  color: white;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.score-label {
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
}

.team-card.place-1 .score-label,
.team-card.place-2 .score-label,
.team-card.place-3 .score-label {
  color: rgba(255, 255, 255, 0.9);
}

.no-teams {
  text-align: center;
  padding: 3rem;
  color: #666;
  font-style: italic;
}
</style>
