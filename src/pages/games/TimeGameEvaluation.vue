<template>
  <div>
    <base-dialog :show="!!error" title="An error occurred!" @close="handleError">
      <p>{{ error }}</p>
    </base-dialog>

    <section v-if="!isLoading && game">
      <base-card>
        <the-breadcrumb :crumbs="[
          { label: 'Gaming Groups', to: '/gaming-groups' },
          { label: game.gamingGroupName || 'Group', to: `/gaming-groups/${game.gamingGroupId}` },
          { label: game.name }
        ]"></the-breadcrumb>

        <div class="game-header">
          <div class="game-info">
            <h2>{{ game.name }}</h2>
            <p class="description">{{ game.description }}</p>
            <div class="game-settings">
              <span class="setting-badge time">Time-Based</span>
              <span class="setting-badge">Max: {{ game.maximumPoint / 10 }}s = {{ game.maximumPoint }} pts</span>
              <span class="setting-badge">{{ game.timingMode === 'client' ? 'Client-Trusted' : 'Server-Trusted' }}</span>
            </div>
          </div>
        </div>

        <!-- Team Codes Section -->
        <div class="teams-section">
          <h3>Teams</h3>

          <div class="teams-list">
            <div
              v-for="team in groupTeams"
              :key="team.id"
              class="team-row"
              :class="{ selected: selectedTeams.includes(team.id) }"
            >
              <div class="team-checkbox">
                <input
                  type="checkbox"
                  :id="`team-${team.id}`"
                  :checked="selectedTeams.includes(team.id)"
                  @change="toggleTeam(team.id)"
                  :disabled="getTeamCode(team.id)"
                />
              </div>

              <div class="team-name">
                <label :for="`team-${team.id}`">{{ team.name }}</label>
              </div>

              <div class="team-code" :class="getCodeStatus(team.id)">
                <span v-if="getTeamCode(team.id)">
                  {{ getCodeStatus(team.id) === 'active' ? 'conn.' : getTeamCode(team.id) }}
                </span>
                <span v-else class="no-code">---</span>
              </div>

              <div class="team-result" v-if="roundResults.length > 0">
                <span v-if="getTeamResult(team.id)">
                  {{ getTeamResult(team.id).displayTime }}s = {{ getTeamResult(team.id).points }} pts
                </span>
              </div>

              <div class="team-actions">
                <button
                  v-if="!getTeamCode(team.id)"
                  class="action-btn generate"
                  @click="generateCode(team.id)"
                >
                  generate code
                </button>
                <button
                  v-else
                  class="action-btn reset"
                  @click="resetCode(team.id)"
                >
                  reset code
                </button>
              </div>
            </div>
          </div>

          <!-- Bulk Actions -->
          <div class="bulk-actions">
            <base-button
              mode="flat"
              @click="generateCodesForSelected"
              :disabled="selectedTeams.length === 0"
            >
              Generate Codes for Selected
            </base-button>
          </div>
        </div>

        <!-- Game Controls -->
        <div class="game-controls">
          <div class="control-row" v-if="gameState === 'idle' || gameState === 'completed'">
            <div class="countdown-select">
              <label>Countdown:</label>
              <select v-model="countdownSeconds">
                <option :value="3">3 sec</option>
                <option :value="5">5 sec</option>
                <option :value="10">10 sec</option>
              </select>
            </div>

            <base-button
              @click="startGame"
              :disabled="connectedTeamsCount === 0"
            >
              Start Game ({{ connectedTeamsCount }} teams ready)
            </base-button>
          </div>

          <div class="control-row" v-if="gameState === 'countdown'">
            <div class="countdown-display">{{ countdownDisplay }}</div>
          </div>

          <div class="control-row" v-if="gameState === 'running'">
            <div class="running-display">Game in progress...</div>
            <base-button mode="flat" @click="discardRound" v-if="showDiscardButton">
              Discard Round
            </base-button>
          </div>

          <div class="control-row results" v-if="gameState === 'completed' && roundResults.length > 0">
            <h3>Round Results</h3>
            <div class="results-list">
              <div
                v-for="(result, index) in sortedResults"
                :key="result.teamId"
                class="result-row"
                :class="{ timeout: result.timedOut }"
              >
                <span class="rank">{{ index + 1 }}</span>
                <span class="name">{{ result.teamName }}</span>
                <span class="time">{{ result.timedOut ? 'TIMEOUT' : result.displayTime + 's' }}</span>
                <span class="points">{{ result.points }} pts</span>
              </div>
            </div>

            <div class="confirm-actions">
              <base-button @click="confirmResults">Confirm & Save</base-button>
              <base-button mode="flat" @click="discardRound">Discard</base-button>
            </div>
          </div>
        </div>

        <!-- Connection Status -->
        <div class="connection-status" :class="{ connected: socketConnected }">
          {{ socketConnected ? 'Connected' : 'Disconnected' }}
        </div>
      </base-card>
    </section>

    <base-spinner v-else></base-spinner>
  </div>
</template>

<script>
import { io } from 'socket.io-client';
import { API_BASE_URL, SOCKET_URL } from '../../config.js';
import TheBreadcrumb from '../../components/ui/TheBreadcrumb.vue';

export default {
  components: {
    TheBreadcrumb
  },
  props: ['id'],
  data() {
    return {
      isLoading: false,
      error: null,
      game: null,
      groupTeams: [],
      teamCodes: [],
      selectedTeams: [],
      socket: null,
      socketConnected: false,
      gameState: 'idle', // idle, countdown, running, completed
      countdownSeconds: 5,
      countdownDisplay: '',
      countdownInterval: null,
      roundResults: [],
      showDiscardButton: false,
      discardTimeout: null
    };
  },
  computed: {
    connectedTeamsCount() {
      return this.teamCodes.filter(c => c.status === 'active').length;
    },
    sortedResults() {
      return [...this.roundResults].sort((a, b) => a.reactionTimeMs - b.reactionTimeMs);
    }
  },
  async created() {
    await this.loadData();
    this.connectSocket();
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
      if (this.discardTimeout) {
        clearTimeout(this.discardTimeout);
      }
    },

    async loadData() {
      this.isLoading = true;
      try {
        await this.$store.dispatch('games/loadGames', { forceRefresh: true });
        this.game = this.$store.getters['games/getGameById'](parseInt(this.id));

        if (!this.game) {
          this.$router.replace('/games');
          return;
        }

        // Redirect if not a time-based game
        if (this.game.gameType !== 'time') {
          this.$router.replace(`/games/${this.id}`);
          return;
        }

        await this.loadGroupTeams();
        await this.loadAccessCodes();
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

    async loadAccessCodes() {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/games/${this.id}/access-codes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          this.teamCodes = await response.json();
        }
      } catch (error) {
        console.error('Failed to load access codes:', error);
      }
    },

    connectSocket() {
      const token = localStorage.getItem('token');
      this.socket = io(SOCKET_URL);

      this.socket.on('connect', () => {
        console.log('Evaluator socket connected');
        this.socketConnected = true;
        this.socket.emit('evaluator:join', {
          gameId: parseInt(this.id),
          token
        });
      });

      this.socket.on('disconnect', () => {
        console.log('Socket disconnected');
        this.socketConnected = false;
      });

      this.socket.on('teams:status', (statuses) => {
        console.log('Teams status:', statuses);
        statuses.forEach(s => {
          const code = this.teamCodes.find(c => c.teamId === s.teamId);
          if (code) {
            code.status = s.status;
          }
        });
      });

      this.socket.on('team:connected', (data) => {
        console.log('Team connected:', data);
        const code = this.teamCodes.find(c => c.teamId === data.teamId);
        if (code) {
          code.status = 'active';
        }
      });

      this.socket.on('team:disconnected', (data) => {
        console.log('Team disconnected:', data);
        const code = this.teamCodes.find(c => c.teamId === data.teamId);
        if (code) {
          code.status = 'available';
        }
      });

      this.socket.on('team:lost', (data) => {
        console.log('Team lost:', data);
        const code = this.teamCodes.find(c => c.teamId === data.teamId);
        if (code) {
          code.status = 'used';
        }
      });

      this.socket.on('game:countdown', (data) => {
        console.log('Countdown started:', data);
        this.gameState = 'countdown';
        this.startCountdownDisplay(data.startsAt);
      });

      this.socket.on('game:go', () => {
        console.log('GO!');
        this.gameState = 'running';
        this.countdownDisplay = 'GO!';

        // Show discard button after 3 seconds
        this.discardTimeout = setTimeout(() => {
          this.showDiscardButton = true;
        }, 3000);
      });

      this.socket.on('team:pressed', (data) => {
        console.log('Team pressed:', data);
        // Update results in real-time
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
        this.showDiscardButton = false;
      });

      this.socket.on('game:confirmed', () => {
        console.log('Results confirmed');
        this.gameState = 'idle';
        this.roundResults = [];
      });

      this.socket.on('game:discarded', () => {
        console.log('Round discarded');
        this.gameState = 'idle';
        this.roundResults = [];
        this.showDiscardButton = false;
      });

      this.socket.on('error', (data) => {
        console.error('Socket error:', data);
        this.error = data.message;
      });
    },

    startCountdownDisplay(startsAt) {
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

    getTeamCode(teamId) {
      const code = this.teamCodes.find(c => c.teamId === teamId);
      return code ? code.code : null;
    },

    getCodeStatus(teamId) {
      const code = this.teamCodes.find(c => c.teamId === teamId);
      return code ? code.status : null;
    },

    getTeamResult(teamId) {
      return this.roundResults.find(r => r.teamId === teamId);
    },

    toggleTeam(teamId) {
      const index = this.selectedTeams.indexOf(teamId);
      if (index === -1) {
        this.selectedTeams.push(teamId);
      } else {
        this.selectedTeams.splice(index, 1);
      }
    },

    async generateCode(teamId) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/games/${this.id}/access-codes/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ teamId })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to generate code');
        }

        const data = await response.json();

        // Update local state
        const existing = this.teamCodes.find(c => c.teamId === teamId);
        if (existing) {
          existing.code = data.code;
          existing.status = 'available';
        } else {
          this.teamCodes.push({
            teamId,
            code: data.code,
            status: 'available'
          });
        }
      } catch (error) {
        this.error = error.message;
      }
    },

    async generateCodesForSelected() {
      const teamsWithoutCodes = this.selectedTeams.filter(tid => !this.getTeamCode(tid));

      if (teamsWithoutCodes.length === 0) {
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/games/${this.id}/access-codes/generate-bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ teamIds: teamsWithoutCodes })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to generate codes');
        }

        const data = await response.json();

        // Update local state
        data.codes.forEach(({ teamId, code }) => {
          const existing = this.teamCodes.find(c => c.teamId === teamId);
          if (existing) {
            existing.code = code;
            existing.status = 'available';
          } else {
            this.teamCodes.push({
              teamId,
              code,
              status: 'available'
            });
          }
        });

        this.selectedTeams = [];
      } catch (error) {
        this.error = error.message;
      }
    },

    async resetCode(teamId) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/games/${this.id}/access-codes/reset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ teamId })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to reset code');
        }

        const data = await response.json();

        // Update local state
        const existing = this.teamCodes.find(c => c.teamId === teamId);
        if (existing) {
          existing.code = data.code;
          existing.status = 'available';
        }
      } catch (error) {
        this.error = error.message;
      }
    },

    startGame() {
      if (this.connectedTeamsCount === 0) return;

      this.roundResults = [];
      this.showDiscardButton = false;

      this.socket.emit('game:start', {
        gameId: parseInt(this.id),
        countdownSeconds: this.countdownSeconds
      });
    },

    discardRound() {
      this.socket.emit('game:discard', {
        gameId: parseInt(this.id)
      });
    },

    confirmResults() {
      this.socket.emit('game:confirm', {
        gameId: parseInt(this.id)
      });
    },

    handleError() {
      this.error = null;
    }
  }
};
</script>

<style scoped>
.game-header {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #e0e0e0;
}

.game-info h2 {
  font-size: 1.75rem;
  margin: 0 0 0.5rem 0;
}

.description {
  color: #666;
  margin: 0 0 1rem 0;
}

.game-settings {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.setting-badge {
  display: inline-block;
  padding: 0.3rem 0.75rem;
  background: #f0e6fd;
  border-radius: 12px;
  font-size: 0.85rem;
  color: #3d008d;
}

.setting-badge.time {
  background: #e3f2fd;
  color: #1565c0;
}

/* Teams Section */
.teams-section {
  margin-bottom: 2rem;
}

.teams-section h3 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
  color: #3d008d;
}

.teams-list {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.team-row {
  display: flex;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  gap: 1rem;
}

.team-row:last-child {
  border-bottom: none;
}

.team-row.selected {
  background: #f0e6fd;
}

.team-checkbox {
  flex-shrink: 0;
}

.team-checkbox input {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.team-name {
  flex: 1;
  font-weight: 500;
}

.team-name label {
  cursor: pointer;
}

.team-code {
  min-width: 60px;
  text-align: center;
  font-family: monospace;
  font-size: 1.1rem;
  font-weight: bold;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.team-code.available {
  color: #dc3545;
  background: #ffe6e6;
}

.team-code.active {
  color: #28a745;
  background: #e6ffe6;
}

.team-code.used {
  color: #dc3545;
  background: #ffe6e6;
}

.no-code {
  color: #999;
}

.team-result {
  min-width: 120px;
  text-align: right;
  font-weight: 500;
  color: #28a745;
}

.team-actions {
  flex-shrink: 0;
}

.action-btn {
  padding: 0.4rem 0.75rem;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.action-btn.generate {
  background: #e3f2fd;
  color: #1565c0;
}

.action-btn.generate:hover {
  background: #bbdefb;
}

.action-btn.reset {
  background: #fff3e0;
  color: #e65100;
}

.action-btn.reset:hover {
  background: #ffe0b2;
}

.bulk-actions {
  margin-top: 1rem;
  display: flex;
  gap: 1rem;
}

/* Game Controls */
.game-controls {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.control-row.results {
  flex-direction: column;
  align-items: stretch;
}

.countdown-select {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.countdown-select select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}

.countdown-display {
  font-size: 4rem;
  font-weight: bold;
  color: #3d008d;
  text-align: center;
  width: 100%;
}

.running-display {
  font-size: 1.5rem;
  color: #28a745;
}

/* Results */
.results-list {
  margin: 1rem 0;
}

.result-row {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  gap: 1rem;
}

.result-row.timeout {
  opacity: 0.6;
}

.result-row .rank {
  font-weight: bold;
  color: #3d008d;
  width: 30px;
}

.result-row .name {
  flex: 1;
  font-weight: 500;
}

.result-row .time {
  font-family: monospace;
  font-size: 1.1rem;
  min-width: 80px;
  text-align: right;
}

.result-row .points {
  font-weight: bold;
  color: #28a745;
  min-width: 60px;
  text-align: right;
}

.confirm-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

/* Connection Status */
.connection-status {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.85rem;
  background: #dc3545;
  color: white;
}

.connection-status.connected {
  background: #28a745;
}

/* Mobile */
@media (max-width: 768px) {
  .team-row {
    flex-wrap: wrap;
  }

  .team-actions {
    width: 100%;
    margin-top: 0.5rem;
  }

  .action-btn {
    width: 100%;
  }

  .countdown-display {
    font-size: 3rem;
  }
}
</style>
