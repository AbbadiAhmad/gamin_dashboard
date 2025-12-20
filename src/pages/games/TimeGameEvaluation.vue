<template>
  <div class="time-game-controls" v-if="!isLoading && game">
    <base-dialog :show="!!error" title="An error occurred!" @close="handleError">
      <p>{{ error }}</p>
    </base-dialog>

    <!-- Time-based game settings badge -->
    <div class="game-settings">
      <span class="setting-badge time">Time-Based</span>
      <span class="setting-badge">Max: {{ game.maximumPoint / 10 }}s = {{ game.maximumPoint }} pts</span>
      <span class="setting-badge">{{ game.timingMode === 'client' ? 'Client-Trusted' : 'Server-Trusted' }}</span>
    </div>

    <!-- Team Codes Section -->
    <div class="teams-section">
      <h3>Team Access Codes</h3>
      <div>
        <!-- Teamboard Access Link -->
        <div class="teamboard-link">
        <span class="link-label">Team Access URL:</span>
        <code class="link-url">{{ teamboardUrl }}</code>
        <!-- <button class="copy-btn" @click="copyTeamboardUrl" title="Copy to clipboard">
            {{ copied ? 'Copied!' : 'Copy' }}
          </button> -->
        </div>

        <!-- Audience Dashboard Link -->
        <div class="teamboard-link">
        <span class="link-label">Audience Dashboard:</span>
        <code class="link-url">{{ audienceUrl }}</code>
        <!-- <button class="copy-btn" @click="copyAudienceUrl" title="Copy to clipboard">
            {{ copiedAudience ? 'Copied!' : 'Copy' }}
          </button> -->
        <a :href="audienceUrl" target="_blank" class="open-btn">Open</a> 
        </div>
      </div>
      <div class="teams-list">
        <!-- Header row -->
        <div class="team-row header">
          <div class="team-checkbox">Sel</div>
          <div class="team-offline">Off</div>
          <div class="team-name">Team</div>
          <div class="team-code">Code</div>
          <div class="team-result" v-if="roundResults.length > 0">Result</div>
          <div class="team-actions">Actions</div>
        </div>

        <div v-for="team in groupTeams" :key="team.id" class="team-row"
          :class="{ selected: isTeamSelected(team.id), offline: isTeamOfflineAllowed(team.id) }">
          <div class="team-checkbox">
            <input type="checkbox" :id="`team-sel-${team.id}`"
              :checked="isTeamSelected(team.id)"
              @change="toggleTeamSelection(team.id)"
              :disabled="!getTeamCode(team.id)"
              title="Select team for next round" />
          </div>

          <div class="team-offline">
            <input type="checkbox" :id="`team-off-${team.id}`"
              :checked="isTeamOfflineAllowed(team.id)"
              @change="toggleOfflineMode(team.id)"
              :disabled="!getTeamCode(team.id)"
              title="Allow offline mode (manual time entry)" />
          </div>

          <div class="team-name">
            <label :for="`team-sel-${team.id}`">{{ team.name }}</label>
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
            <button v-if="!getTeamCode(team.id)" class="action-btn generate" @click="generateCode(team.id)">
              generate
            </button>
            <button v-else class="action-btn reset" @click="resetCode(team.id)">
              reset
            </button>
          </div>
        </div>
      </div>

      <!-- Bulk Actions -->
      <div class="bulk-actions">
        <base-button mode="flat" @click="generateCodesForSelected" :disabled="selectedTeamsWithoutCodes.length === 0">
          Generate Codes for Selected ({{ selectedTeamsWithoutCodes.length }})
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

        <base-button @click="startGame" :disabled="readyTeamsCount === 0">
          Start Game ({{ readyTeamsCount }} teams ready)
        </base-button>
      </div>

      <div class="control-row" v-if="gameState === 'countdown'">
        <div class="countdown-display">{{ countdownDisplay }}</div>
      </div>

      <div class="control-row" v-if="gameState === 'running'">
        <div class="running-display">
          Game in progress... ({{ roundResults.length }}/{{ selectedTeamsCount }} pressed)
        </div>
        <base-button mode="flat" @click="discardRound" v-if="showDiscardButton">
          Discard Round
        </base-button>
      </div>

      <!-- Manual Time Input for Offline Teams -->
      <div class="manual-time-section" v-if="(gameState === 'running' || gameState === 'completed') && offlineTeamsWithoutResults.length > 0">
        <h4>Manual Time Entry (Offline Teams)</h4>
        <div class="manual-time-list">
          <div v-for="code in offlineTeamsWithoutResults" :key="code.teamId" class="manual-time-row">
            <span class="team-label">{{ code.teamName }}</span>
            <input
              type="number"
              step="0.1"
              min="0"
              :max="game.maximumPoint / 10"
              :value="manualTimeInput[code.teamId] ? manualTimeInput[code.teamId].time : ''"
              @input="e => { if(!manualTimeInput[code.teamId]) manualTimeInput[code.teamId] = { time: '', show: true }; manualTimeInput[code.teamId].time = e.target.value; }"
              placeholder="Time (s)"
              class="time-input"
            />
            <button
              class="action-btn generate"
              @click="submitManualTime(code.teamId)"
              :disabled="loadingManualTime || !manualTimeInput[code.teamId]?.time"
            >
              Record
            </button>
          </div>
        </div>
      </div>

      <!-- Show results in real-time (always visible when there are results) -->
      <div class="control-row results" v-if="roundResults.length > 0">
        <h3>
          {{ gameState === 'running' ? 'Live Results' : 'Round Results' }}
          <span v-if="confirmedTeamIds.size > 0" class="confirmed-badge">
            {{ confirmedTeamIds.size }} saved
          </span>
        </h3>
        <div class="results-list">
          <div v-for="(result, index) in sortedResults" :key="result.teamId" class="result-row" :class="{
            timeout: result.timedOut,
            confirmed: isResultConfirmed(result.teamId),
            unconfirmed: !isResultConfirmed(result.teamId)
          }">
            <span class="rank">{{ index + 1 }}</span>
            <span class="name">{{ result.teamName }}</span>
            <span class="time">{{ result.timedOut ? 'TIMEOUT' : result.displayTime + 's' }}</span>
            <span class="points">{{ result.points }} pts</span>
            <span class="status-icon" :title="isResultConfirmed(result.teamId) ? 'Saved' : 'Not saved'">
              {{ isResultConfirmed(result.teamId) ? '✓' : '○' }}
            </span>
          </div>
        </div>

        <div class="confirm-actions">
          <base-button @click="confirmResults" :disabled="!hasUnconfirmedResults">
            {{ hasUnconfirmedResults ? `Save New Results (${unconfirmedCount})` : 'All Saved' }}
          </base-button>
          <base-button mode="flat" @click="discardRound">Discard All</base-button>
        </div>
      </div>

    </div>

    <!-- Event Log Section -->
    <div class="event-log-section" v-if="eventLog.length > 0">
      <div class="event-log-header">
        <h3>Event Log</h3>
        <button class="action-btn reset" @click="clearEventLog">Clear Log</button>
      </div>
      <div class="event-log-list">
        <div v-for="event in eventLog" :key="event.id" class="event-row">
          <span class="event-time">{{ formatEventTime(event.timestamp) }}</span>
          <span class="event-actor" :class="event.actor_type">{{ event.actor }}</span>
          <span class="event-description">{{ event.description }}</span>
        </div>
      </div>
    </div>

    <!-- Connection Status -->
    <div class="connection-status" :class="{ connected: socketConnected }">
      {{ socketConnected ? 'Connected' : 'Disconnected' }}
    </div>
  </div>
  <base-spinner v-else-if="isLoading"></base-spinner>
</template>

<script>
import { io } from 'socket.io-client';
import { API_BASE_URL, SOCKET_URL } from '../../config.js';

export default {
  props: ['id'],
  emits: ['scores-updated'],
  data() {
    return {
      isLoading: false,
      error: null,
      game: null,
      groupTeams: [],
      teamCodes: [],
      socket: null,
      socketConnected: false,
      gameState: 'idle', // idle, countdown, running, completed
      countdownSeconds: 5,
      countdownDisplay: '',
      countdownInterval: null,
      roundResults: [],
      confirmedTeamIds: new Set(), // Track which teams have been confirmed
      showDiscardButton: false,
      discardTimeout: null,
      copied: false,
      copiedAudience: false,
      eventLog: [],
      manualTimeInput: {}, // teamId -> { time: '', show: false }
      loadingManualTime: false
    };
  },
  computed: {
    connectedTeamsCount() {
      return this.teamCodes.filter(c => c.status === 'active').length;
    },
    selectedTeamsCount() {
      return this.teamCodes.filter(c => c.isSelected).length;
    },
    readyTeamsCount() {
      // Count selected teams that are either connected OR offline-allowed
      return this.teamCodes.filter(c =>
        c.isSelected && (c.status === 'active' || c.offlineAllowed)
      ).length;
    },
    sortedResults() {
      return [...this.roundResults].sort((a, b) => a.reactionTimeMs - b.reactionTimeMs);
    },
    selectedTeamsWithoutCodes() {
      return this.groupTeams
        .filter(t => this.isTeamSelected(t.id) && !this.getTeamCode(t.id))
        .map(t => t.id);
    },
    teamboardUrl() {
      return `${window.location.origin}/teamboard`;
    },
    audienceUrl() {
      return `${window.location.origin}/audience/${this.id}`;
    },
    unconfirmedCount() {
      return this.roundResults.filter(r => !this.confirmedTeamIds.has(r.teamId)).length;
    },
    hasUnconfirmedResults() {
      return this.unconfirmedCount > 0;
    },
    offlineTeamsWithoutResults() {
      // Get offline-allowed teams that haven't pressed yet
      return this.teamCodes.filter(c =>
        c.offlineAllowed &&
        c.isSelected &&
        !this.roundResults.find(r => r.teamId === c.teamId)
      );
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
        await this.loadEventLog();
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

    async loadEventLog() {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/games/${this.id}/event-log`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          this.eventLog = await response.json();
        }
      } catch (error) {
        console.error('Failed to load event log:', error);
      }
    },

    async clearEventLog() {
      if (!confirm('Clear all event logs for this game?')) return;

      try {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_URL}/games/${this.id}/event-log`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        this.eventLog = [];
      } catch (error) {
        console.error('Failed to clear event log:', error);
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

      this.socket.on('game:confirmed', (data) => {
        console.log('Results confirmed', data);
        // Mark confirmed results using server-provided IDs
        if (data.confirmedTeamIds) {
          data.confirmedTeamIds.forEach(id => {
            this.confirmedTeamIds.add(id);
          });
        }
        // Notify parent to refresh scores
        this.$emit('scores-updated');
        // Reload event log
        this.loadEventLog();
      });

      this.socket.on('game:discarded', () => {
        console.log('Round discarded');
        this.gameState = 'idle';
        this.roundResults = [];
        this.confirmedTeamIds = new Set();
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

    isTeamSelected(teamId) {
      const code = this.teamCodes.find(c => c.teamId === teamId);
      return code ? code.isSelected : false;
    },

    isTeamOfflineAllowed(teamId) {
      const code = this.teamCodes.find(c => c.teamId === teamId);
      return code ? code.offlineAllowed : false;
    },

    getTeamName(teamId) {
      const team = this.groupTeams.find(t => t.id === teamId);
      return team ? team.name : 'Unknown';
    },

    async toggleTeamSelection(teamId) {
      const code = this.teamCodes.find(c => c.teamId === teamId);
      if (!code) return;

      const newValue = !code.isSelected;
      try {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_URL}/games/${this.id}/access-codes/${teamId}/selected`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ isSelected: newValue })
        });

        code.isSelected = newValue;
      } catch (error) {
        this.error = error.message || 'Failed to update selection';
      }
    },

    async toggleOfflineMode(teamId) {
      const code = this.teamCodes.find(c => c.teamId === teamId);
      if (!code) return;

      const newValue = !code.offlineAllowed;
      try {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_URL}/games/${this.id}/access-codes/${teamId}/offline`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ offlineAllowed: newValue })
        });

        code.offlineAllowed = newValue;
      } catch (error) {
        this.error = error.message || 'Failed to update offline mode';
      }
    },

    toggleManualTimeInput(teamId) {
      if (!this.manualTimeInput[teamId]) {
        this.manualTimeInput[teamId] = { time: '', show: true };
      } else {
        this.manualTimeInput[teamId].show = !this.manualTimeInput[teamId].show;
      }
    },

    async submitManualTime(teamId) {
      const input = this.manualTimeInput[teamId];
      if (!input || !input.time) return;

      const timeInSeconds = parseFloat(input.time);
      if (isNaN(timeInSeconds) || timeInSeconds < 0) {
        this.error = 'Invalid time value';
        return;
      }

      const reactionTimeMs = Math.round(timeInSeconds * 1000);
      const maxPoints = this.game.maximumPoint;
      const points = Math.max(0, maxPoints - Math.floor(reactionTimeMs / 100));

      this.loadingManualTime = true;
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/games/${this.id}/access-codes/${teamId}/manual-time`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ reactionTimeMs, points })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to record time');
        }

        // Close the input
        input.show = false;
        input.time = '';

        // Reload event log
        await this.loadEventLog();
      } catch (error) {
        this.error = error.message;
      }
      this.loadingManualTime = false;
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
      if (this.readyTeamsCount === 0) return;

      this.roundResults = [];
      this.confirmedTeamIds = new Set();
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
    },

    isResultConfirmed(teamId) {
      return this.confirmedTeamIds.has(teamId);
    },

    async copyTeamboardUrl() {
      try {
        await navigator.clipboard.writeText(this.teamboardUrl);
        this.copied = true;
        setTimeout(() => {
          this.copied = false;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    },

    async copyAudienceUrl() {
      try {
        await navigator.clipboard.writeText(this.audienceUrl);
        this.copiedAudience = true;
        setTimeout(() => {
          this.copiedAudience = false;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    },

    formatEventTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  }
};
</script>

<style scoped>
.time-game-controls {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 2px solid #e0e0e0;
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

/* Teamboard Link */
.teamboard-link {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  padding: 0.3rem;
  background: #f5f5f5;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.link-label {
  font-weight: 500;
  color: #666;
}

.link-url {
  background: white;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-family: monospace;
  font-size: 0.95rem;
  color: #3d008d;
  flex: 1;
  min-width: 200px;
}

.copy-btn {
  padding: 0.5rem 1rem;
  background: #3d008d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.copy-btn:hover {
  background: #5c00b8;
}

.open-btn {
  padding: 0.5rem 1rem;
  background: #999;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  text-decoration: none;
  transition: background-color 0.2s;
}

.open-btn:hover {
  background: #218838;
}

.audience-link {
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
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

.result-row.confirmed {
  background: #e8f5e9;
  border-color: #a5d6a7;
}

.result-row.unconfirmed {
  background: #fff8e1;
  border-color: #ffe082;
}

.status-icon {
  font-size: 1.2rem;
  min-width: 24px;
  text-align: center;
}

.result-row.confirmed .status-icon {
  color: #28a745;
}

.result-row.unconfirmed .status-icon {
  color: #ffa000;
}

.confirmed-badge {
  font-size: 0.8rem;
  background: #28a745;
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  margin-left: 0.5rem;
  font-weight: normal;
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

/* Team row header and offline styles */
.team-row.header {
  background: #f0f0f0;
  font-weight: bold;
  font-size: 0.85rem;
  color: #666;
  padding: 0.5rem 1rem;
}

.team-offline {
  flex-shrink: 0;
  min-width: 30px;
}

.team-offline input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.team-row.offline {
  background: #fff3e0;
  border-left: 3px solid #ff9800;
}

.team-row.selected.offline {
  background: linear-gradient(135deg, #f0e6fd 50%, #fff3e0 50%);
}

/* Manual Time Section */
.manual-time-section {
  margin-top: 1rem;
  padding: 1rem;
  background: #fff3e0;
  border-radius: 8px;
  border: 1px solid #ffcc80;
}

.manual-time-section h4 {
  margin: 0 0 0.75rem 0;
  color: #e65100;
  font-size: 1rem;
}

.manual-time-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.manual-time-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.manual-time-row .team-label {
  min-width: 120px;
  font-weight: 500;
}

.manual-time-row .time-input {
  width: 100px;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  text-align: center;
}

/* Event Log Section */
.event-log-section {
  margin-top: 2rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.event-log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.event-log-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.1rem;
}

.event-log-list {
  max-height: 300px;
  overflow-y: auto;
}

.event-row {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e0e0e0;
  font-size: 0.9rem;
}

.event-row:last-child {
  border-bottom: none;
}

.event-time {
  color: #666;
  font-family: monospace;
  min-width: 85px;
}

.event-actor {
  font-weight: 500;
  min-width: 80px;
}

.event-actor.evaluator {
  color: #3d008d;
}

.event-actor.team {
  color: #1565c0;
}

.event-actor.system {
  color: #666;
}

.event-description {
  flex: 1;
  color: #333;
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
