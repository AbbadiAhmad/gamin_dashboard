<template>
  <div :class="{ 'fullscreen-mode': isFullscreen }">
    <!-- Celebration overlay -->
    <div v-if="showCelebration" class="celebration-overlay">
      <div class="celebration-content">
        <h1 class="celebration-title">🎉 Game Finished! 🎉</h1>
        <p class="celebration-subtitle">Congratulations to all participants!</p>
      </div>
      <div class="confetti-container">
        <div v-for="i in 50" :key="i" class="confetti" :style="getConfettiStyle(i)"></div>
      </div>
    </div>

    <!-- Offline indicator -->
    <div v-if="isOffline" class="offline-indicator">
      <span class="offline-icon">⚠</span>
      <span>Offline - No updates for 15+ seconds</span>
    </div>

    <base-dialog :show="!!error" title="An error occurred!" @close="handleError">
      <p>{{ error }}</p>
    </base-dialog>
    <section v-if="game" class="live-game-container">
      <div class="game-header" v-if="!isFullscreen">
        <div class="header-content">
          <base-button mode="flat" @click="goBack" class="back-button">← Back to Dashboard</base-button>
          <h1>{{ game.name }}</h1>
          <p class="game-description">{{ game.description }}</p>
          <div class="game-info">
            <base-badge :type="game.gamingGroupName" :title="game.gamingGroupName"></base-badge>
            <span v-if="game.status === 'running'" class="live-indicator">
              <span class="live-dot"></span>
              LIVE
            </span>
            <span v-else-if="game.status === 'past'" class="finished-indicator">
              ✓ FINISHED
            </span>
          </div>
        </div>
      </div>

      <div class="fullscreen-controls">
        <button @click="toggleFullscreen" class="fullscreen-btn" :title="isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'">
          <span v-if="!isFullscreen">[⛶]</span>
          <span v-else>[✕]</span>
        </button>
      </div>

      <div class="leaderboard-container">
        <div class="leaderboard-header" v-if="isFullscreen">
          <h1 class="game-title">{{ game.name }}</h1>
          <span v-if="game.status === 'running'" class="live-indicator-fullscreen">
            <span class="live-dot"></span>
            LIVE
          </span>
          <span v-else-if="game.status === 'past'" class="finished-indicator-fullscreen">
            ✓ FINISHED
          </span>
        </div>

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
    </section>
    <base-spinner v-if="isLoading && !game"></base-spinner>
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
      offlineCheckInterval: null,
      previousOrder: [],
      isFullscreen: false,
      previousGameStatus: null,
      showCelebration: false,
      isOffline: false,
      lastUpdateTime: null
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

      teamsWithScores.forEach((team) => {
        if (previousScore !== null && team.score < previousScore) {
          currentPlace++;
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
      this.refreshData(); // Optimized refresh - only fetch what's needed
    }, 3000);
    // Check for offline status every 15 seconds
    this.offlineCheckInterval = setInterval(() => {
      this.checkOfflineStatus();
    }, 15000);
  },
  methods: {
    async loadData() {
      this.isLoading = true;
      try {
        await this.$store.dispatch('games/loadGames', { forceRefresh: true });
        const newGame = this.$store.getters['games/getGameById'](parseInt(this.id));

        if (!newGame) {
          this.$router.replace('/dashboard');
          return;
        }

        // Check if game status changed from running to past
        if (this.previousGameStatus === 'running' && newGame.status === 'past') {
          this.triggerCelebration();
        }

        // Update previous status
        this.previousGameStatus = newGame.status;
        this.game = newGame;

        // Allow viewing both running and past games
        if (this.game.status !== 'running' && this.game.status !== 'past') {
          this.error = 'This game is not available for viewing';
          setTimeout(() => {
            this.$router.replace('/dashboard');
          }, 2000);
          return;
        }

        await this.loadGroupTeams();
        await this.loadGameScores();
        this.lastUpdateTime = Date.now();
        this.isOffline = false;
      } catch (error) {
        this.error = error.message || 'Failed to load data';
      }
      this.isLoading = false;
    },
    async refreshData() {
      // Optimized refresh - only fetch scores and game status, no loading spinner
      try {
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Fetch game status and scores in parallel
        const [gameResponse, scoresResponse] = await Promise.all([
          fetch(`http://localhost:3000/games/${this.id}`, { headers }),
          fetch(`http://localhost:3000/games/${this.id}/scores`, { headers })
        ]);

        if (gameResponse.ok && scoresResponse.ok) {
          const newGame = await gameResponse.json();
          const newScores = await scoresResponse.json();

          // Check if game status changed from running to past
          if (this.previousGameStatus === 'running' && newGame.status === 'past') {
            this.triggerCelebration();
          }

          // Update previous status
          this.previousGameStatus = newGame.status;

          // Update game and scores
          this.game = newGame;
          this.gameScores = newScores;
          this.lastUpdateTime = Date.now();
          this.isOffline = false;
        }
      } catch (error) {
        console.error('Failed to refresh data:', error);
      }
    },
    checkOfflineStatus() {
      if (this.lastUpdateTime) {
        const timeSinceUpdate = Date.now() - this.lastUpdateTime;
        // Show offline if no update for 15 seconds
        if (timeSinceUpdate > 15000) {
          this.isOffline = true;
        }
      }
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
    toggleFullscreen() {
      this.isFullscreen = !this.isFullscreen;
      if (this.isFullscreen) {
        // Hide the header element
        const header = document.querySelector('header');
        if (header) {
          header.style.display = 'none';
        }
      } else {
        // Show the header element
        const header = document.querySelector('header');
        if (header) {
          header.style.display = 'flex';
        }
      }
    },
    goBack() {
      this.$router.push('/dashboard');
    },
    handleError() {
      this.error = null;
    },
    triggerCelebration() {
      this.showCelebration = true;
      // Hide celebration after 5 seconds
      setTimeout(() => {
        this.showCelebration = false;
      }, 5000);
    },
    getConfettiStyle(index) {
      const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
      return {
        left: Math.random() * 100 + '%',
        animationDelay: Math.random() * 3 + 's',
        backgroundColor: colors[index % colors.length],
        animationDuration: (Math.random() * 3 + 2) + 's'
      };
    }
  },
  beforeUnmount() {
    // Clear refresh interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    // Clear offline check interval
    if (this.offlineCheckInterval) {
      clearInterval(this.offlineCheckInterval);
    }
    // Restore header if component is destroyed while in fullscreen
    const header = document.querySelector('header');
    if (header) {
      header.style.display = 'flex';
    }
  }
};
</script>

<style scoped>
.fullscreen-mode {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  z-index: 9999;
  overflow: auto;
}

.live-game-container {
  position: relative;
  min-height: 100vh;
}

.fullscreen-controls {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 10000;
}

.fullscreen-btn {
  background: rgba(200, 181, 225, 0.5);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 0.5rem 0.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.fullscreen-btn:hover {
  background: rgba(61, 0, 141, 1);
  border-color: rgba(255, 255, 255, 0.6);
  transform: scale(1.05);
}

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

.leaderboard-container {
  padding: 2rem;
}

.leaderboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

.game-title {
  color: white;
  font-size: 3rem;
  margin: 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.live-indicator-fullscreen {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #ff4444;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 25px;
  font-weight: bold;
  font-size: 1.2rem;
  box-shadow: 0 4px 15px rgba(255, 68, 68, 0.4);
}

.leaderboard h2 {
  font-size: 2rem;
  margin: 0 0 1.5rem 0;
  color: #3d008d;
}



.team-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 12px;
  border: 2px solid #e0e0e0;
  transition: all 0.3s ease;
  min-height: 70px;
  margin-bottom: 0.5rem;
}

.fullscreen-mode .team-card {
  padding: 0.5rem 4rem;
  min-height: 100px;
  margin-bottom: 0.5rem;
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
  min-width: 70px;
}

.fullscreen-mode .place-indicator {
  min-width: 90px;
}

.place-number {
  font-size: 1.75rem;
  font-weight: bold;
  color: #3d008d;
}

.fullscreen-mode .place-number {
  font-size: 2.5rem;
}

.team-card.place-1 .place-number,
.team-card.place-2 .place-number,
.team-card.place-3 .place-number {
  color: white;
  text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.5);
  font-weight: 900;
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
  color: rgba(255, 255, 255, 1);
  text-shadow: 1px 1px 4px rgba(0, 0, 0, 0.8);
  font-weight: 700;
}

.team-info {
  flex: 1;
}

.team-info h3 {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  color: #333;
}

.fullscreen-mode .team-info h3 {
  font-size: 3rem;
}

.team-card.place-1 .team-info h3,
.team-card.place-2 .team-info h3,
.team-card.place-3 .team-info h3 {
  color: white;
  text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.8), 0 0 15px rgba(0, 0, 0, 0.4);
  font-weight: 800;
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
  padding: 0.75rem;
  background: rgba(61, 0, 141, 0.1);
  border-radius: 8px;
  min-width: 90px;
}

.fullscreen-mode .score-display {
  padding: 1rem;
  min-width: 110px;
}

.team-card.place-1 .score-display,
.team-card.place-2 .score-display,
.team-card.place-3 .score-display {
  background: rgba(255, 255, 255, 0.3);
}

.score-value {
  font-size: 1.75rem;
  font-weight: bold;
  color: #3d008d;
}

.fullscreen-mode .score-value {
  font-size: 2.25rem;
}

.team-card.place-1 .score-value,
.team-card.place-2 .score-value,
.team-card.place-3 .score-value {
  color: white;
  text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.8), 0 0 15px rgba(0, 0, 0, 0.4);
  font-weight: 900;
}

.score-label {
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
}

.team-card.place-1 .score-label,
.team-card.place-2 .score-label,
.team-card.place-3 .score-label {
  color: rgba(255, 255, 255, 1);
  text-shadow: 1px 1px 4px rgba(0, 0, 0, 0.8);
  font-weight: 700;
}

.no-teams {
  text-align: center;
  padding: 3rem;
  color: #666;
  font-style: italic;
}

/* Finished indicator styles */
.finished-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #4CAF50;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.9rem;
}

.finished-indicator-fullscreen {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #4CAF50;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 25px;
  font-weight: bold;
  font-size: 1.2rem;
  box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
}

/* Celebration overlay styles */
.celebration-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99999;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.celebration-content {
  text-align: center;
  background: rgba(255, 255, 255, 0.95);
  padding: 3rem 4rem;
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  animation: celebration-popup 0.5s ease-out;
}

.celebration-title {
  font-size: 3.5rem;
  margin: 0 0 1rem 0;
  color: #FFD700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
  animation: celebration-bounce 1s ease-in-out infinite;
}

.celebration-subtitle {
  font-size: 1.5rem;
  margin: 0;
  color: #3d008d;
}

@keyframes celebration-popup {
  from {
    transform: scale(0.5);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes celebration-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-20px);
  }
}

/* Confetti animation */
.confetti-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.confetti {
  position: absolute;
  width: 10px;
  height: 10px;
  top: -10px;
  animation: confetti-fall linear forwards;
}

@keyframes confetti-fall {
  to {
    transform: translateY(100vh) rotate(360deg);
  }
}

/* Offline indicator styles */
.offline-indicator {
  position: fixed;
  top: 5rem;
  right: 2rem;
  background: rgba(255, 152, 0, 0.95);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(255, 152, 0, 0.4);
  z-index: 10001;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 600;
  animation: offline-pulse 2s ease-in-out infinite;
}

.offline-icon {
  font-size: 1.5rem;
  animation: offline-shake 0.5s ease-in-out infinite;
}

@keyframes offline-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 4px 20px rgba(255, 152, 0, 0.4);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 6px 25px rgba(255, 152, 0, 0.6);
  }
}

@keyframes offline-shake {
  0%, 100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-10deg);
  }
  75% {
    transform: rotate(10deg);
  }
}

/* Teams list styles */
.teams-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.fullscreen-mode .teams-list {
  gap: 1.5rem;
}
</style>
