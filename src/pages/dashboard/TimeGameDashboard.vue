<template>
  <div class="audience-dashboard" :class="{ 'dark-mode': darkMode }">
    <!-- Header -->
    <div class="dashboard-header">
      <h1 v-if="game">{{ game.name }}</h1>
      <div class="header-controls">
        <button class="mode-toggle" @click="darkMode = !darkMode">
          {{ darkMode ? '☀️' : '🌙' }}
        </button>
      </div>
    </div>

    <!-- Game Status -->
    <div class="game-status" :class="gameState">
      <span v-if="gameState === 'idle'">Waiting to start...</span>
      <span v-else-if="gameState === 'countdown'" class="countdown-big">{{ countdownDisplay }}</span>
      <span v-else-if="gameState === 'running'" class="go-text">GO!</span>
      <span v-else-if="gameState === 'completed'">Round Complete</span>
    </div>

    <!-- Results Display -->
    <div class="results-container" v-if="sortedResults.length > 0">
      <div class="results-chart">
        <div
          v-for="(result, index) in sortedResults"
          :key="result.teamId"
          class="team-bar-container"
          :style="{ animationDelay: `${index * 0.1}s` }"
        >
          <div class="team-rank">#{{ index + 1 }}</div>
          <div class="team-name">{{ result.teamName }}</div>
          <div class="bar-wrapper">
            <div
              class="team-bar"
              :class="{ timeout: result.timedOut }"
              :style="{ width: getBarWidth(result) + '%' }"
            >
              <span class="bar-time">{{ result.timedOut ? 'TIMEOUT' : result.displayTime + 's' }}</span>
            </div>
          </div>
          <div class="team-points">{{ result.points }} pts</div>
        </div>
      </div>
    </div>

    <!-- Waiting for results -->
    <div class="waiting-message" v-else-if="gameState === 'running'">
      <p>Waiting for teams to press...</p>
    </div>

    <!-- Connection indicator -->
    <div class="connection-indicator" :class="{ connected: socketConnected }">
      {{ socketConnected ? 'LIVE' : 'DISCONNECTED' }}
    </div>

    <!-- Entry form when no game selected -->
    <div class="game-selector" v-if="!game && !isLoading">
      <h2>Enter Game Code</h2>
      <input
        type="text"
        v-model="gameCode"
        placeholder="Game ID"
        @keyup.enter="loadGame"
      />
      <button @click="loadGame">Join</button>
    </div>

    <base-spinner v-if="isLoading"></base-spinner>
  </div>
</template>

<script>
import { io } from 'socket.io-client';
import { API_BASE_URL, SOCKET_URL } from '../../config.js';

export default {
  props: ['id'],
  data() {
    return {
      isLoading: false,
      game: null,
      gameCode: '',
      socket: null,
      socketConnected: false,
      gameState: 'idle',
      countdownDisplay: '',
      countdownInterval: null,
      roundResults: [],
      maxTimeMs: 10000,
      darkMode: true
    };
  },
  computed: {
    sortedResults() {
      return [...this.roundResults].sort((a, b) => a.reactionTimeMs - b.reactionTimeMs);
    }
  },
  async created() {
    if (this.id) {
      this.gameCode = this.id;
      await this.loadGame();
    }
  },
  beforeUnmount() {
    this.cleanup();
  },
  methods: {
    cleanup() {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
    },

    async loadGame() {
      if (!this.gameCode) return;

      this.isLoading = true;
      try {
        const response = await fetch(`${API_BASE_URL}/games/${this.gameCode}`);
        if (response.ok) {
          this.game = await response.json();
          this.maxTimeMs = this.game.maximumPoint * 100;
          this.connectSocket();
        } else {
          alert('Game not found');
        }
      } catch (error) {
        console.error('Error loading game:', error);
      }
      this.isLoading = false;
    },

    connectSocket() {
      this.socket = io(SOCKET_URL);

      this.socket.on('connect', () => {
        console.log('Audience socket connected');
        this.socketConnected = true;
        // Join as audience (no auth needed)
        this.socket.emit('audience:join', {
          gameId: parseInt(this.game.id)
        });
      });

      this.socket.on('disconnect', () => {
        this.socketConnected = false;
      });

      // Handle current game state when joining mid-game
      this.socket.on('game:state', (data) => {
        console.log('Game state received:', data);
        if (data.status === 'running') {
          this.gameState = 'running';
        } else if (data.status === 'completed') {
          this.gameState = 'completed';
        }
        // Load existing results
        if (data.results && data.results.length > 0) {
          this.roundResults = data.results.map(r => ({
            ...r,
            displayTime: r.displayTime || (r.reactionTimeMs / 1000).toFixed(1)
          }));
        }
      });

      this.socket.on('game:countdown', (data) => {
        console.log('Countdown:', data);
        this.gameState = 'countdown';
        this.roundResults = [];
        this.maxTimeMs = data.maxTimeMs;
        this.startCountdown(data.startsAt);
      });

      this.socket.on('game:go', () => {
        this.gameState = 'running';
        this.countdownDisplay = 'GO!';
      });

      this.socket.on('team:pressed', (data) => {
        console.log('Team pressed:', data);
        const existing = this.roundResults.find(r => r.teamId === data.teamId);
        if (existing) {
          Object.assign(existing, data);
        } else {
          this.roundResults.push({
            ...data,
            displayTime: (data.reactionTimeMs / 1000).toFixed(1)
          });
        }
      });

      this.socket.on('game:results', (data) => {
        console.log('Results:', data);
        this.gameState = 'completed';
        this.roundResults = data.results.map(r => ({
          ...r,
          displayTime: (r.reactionTimeMs / 1000).toFixed(1)
        }));
      });

      this.socket.on('game:discarded', () => {
        this.gameState = 'idle';
        this.roundResults = [];
      });

      this.socket.on('game:confirmed', () => {
        // Keep showing results but mark as confirmed
      });
    },

    startCountdown(startsAt) {
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }

      const update = () => {
        const remaining = Math.ceil((startsAt - Date.now()) / 1000);
        if (remaining <= 0) {
          this.countdownDisplay = 'GO!';
          clearInterval(this.countdownInterval);
        } else {
          this.countdownDisplay = remaining.toString();
        }
      };

      update();
      this.countdownInterval = setInterval(update, 100);
    },

    getBarWidth(result) {
      if (result.timedOut) return 100;
      // Invert: faster time = longer bar (more points)
      const maxPoints = this.game?.maximumPoint || 100;
      return Math.min(100, (result.points / maxPoints) * 100);
    }
  }
};
</script>

<style scoped>
.audience-dashboard {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
  padding: 2rem;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.audience-dashboard:not(.dark-mode) {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  color: #333;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.dashboard-header h1 {
  font-size: 3rem;
  margin: 0;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.mode-toggle {
  background: rgba(255,255,255,0.1);
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.5rem;
}

.game-status {
  text-align: center;
  margin-bottom: 2rem;
  padding: 1rem;
  border-radius: 12px;
  background: rgba(255,255,255,0.1);
}

.game-status.countdown {
  background: rgba(255,193,7,0.3);
}

.game-status.running {
  background: rgba(40,167,69,0.3);
}

.game-status.completed {
  background: rgba(61,0,141,0.3);
}

.countdown-big {
  font-size: 8rem;
  font-weight: bold;
  display: block;
  animation: pulse 1s ease-in-out infinite;
}

.go-text {
  font-size: 6rem;
  font-weight: bold;
  color: #4caf50;
  animation: bounce 0.5s ease-in-out;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

@keyframes bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.results-container {
  max-width: 1200px;
  margin: 0 auto;
}

.results-chart {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.team-bar-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  animation: slideIn 0.5s ease-out forwards;
  opacity: 0;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-50px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.team-rank {
  font-size: 2rem;
  font-weight: bold;
  min-width: 60px;
  color: #ffd700;
}

.team-rank:first-child {
  color: #ffd700;
}

.team-bar-container:nth-child(2) .team-rank {
  color: #c0c0c0;
}

.team-bar-container:nth-child(3) .team-rank {
  color: #cd7f32;
}

.team-name {
  font-size: 1.5rem;
  font-weight: 500;
  min-width: 150px;
}

.bar-wrapper {
  flex: 1;
  background: rgba(255,255,255,0.1);
  border-radius: 8px;
  height: 50px;
  overflow: hidden;
}

.team-bar {
  height: 100%;
  background: linear-gradient(90deg, #4caf50 0%, #8bc34a 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 1rem;
  transition: width 0.5s ease-out;
  min-width: 80px;
}

.team-bar.timeout {
  background: linear-gradient(90deg, #f44336 0%, #e57373 100%);
}

.bar-time {
  font-size: 1.25rem;
  font-weight: bold;
  color: white;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
}

.team-points {
  font-size: 1.75rem;
  font-weight: bold;
  min-width: 100px;
  text-align: right;
  color: #4caf50;
}

.team-bar-container:has(.timeout) .team-points {
  color: #f44336;
}

.waiting-message {
  text-align: center;
  font-size: 2rem;
  opacity: 0.7;
  margin-top: 4rem;
}

.connection-indicator {
  position: fixed;
  top: 1rem;
  right: 1rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: bold;
  background: #f44336;
}

.connection-indicator.connected {
  background: #4caf50;
  animation: blink 2s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.game-selector {
  max-width: 400px;
  margin: 4rem auto;
  text-align: center;
  background: rgba(255,255,255,0.1);
  padding: 2rem;
  border-radius: 12px;
}

.game-selector h2 {
  margin-bottom: 1.5rem;
}

.game-selector input {
  width: 100%;
  padding: 1rem;
  font-size: 1.5rem;
  border: none;
  border-radius: 8px;
  margin-bottom: 1rem;
  text-align: center;
}

.game-selector button {
  width: 100%;
  padding: 1rem;
  font-size: 1.25rem;
  background: #3d008d;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.game-selector button:hover {
  background: #5c00b8;
}

/* Responsive */
@media (max-width: 768px) {
  .dashboard-header h1 {
    font-size: 2rem;
  }

  .countdown-big {
    font-size: 5rem;
  }

  .go-text {
    font-size: 4rem;
  }

  .team-bar-container {
    flex-wrap: wrap;
  }

  .team-rank {
    font-size: 1.5rem;
    min-width: 40px;
  }

  .team-name {
    font-size: 1.2rem;
    min-width: 100px;
  }

  .bar-wrapper {
    width: 100%;
    order: 3;
  }

  .team-points {
    font-size: 1.25rem;
  }
}
</style>
