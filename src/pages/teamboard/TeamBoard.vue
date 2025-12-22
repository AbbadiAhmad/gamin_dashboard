<template>
  <div class="team-board" :class="gameState">
    <!-- Code Entry -->
    <div v-if="state === 'entry'" class="entry-screen">
      <div class="entry-card">
        <h1>Enter Access Code</h1>
        <div class="code-input-wrapper">
          <input
            ref="codeInput"
            v-model="accessCode"
            type="text"
            maxlength="3"
            placeholder="___"
            class="code-input"
            inputmode="numeric"
            pattern="[0-9]*"
            @keyup.enter="validateCode"
          />
        </div>
        <p v-if="error" class="error-message">{{ error }}</p>
        <base-button @click="validateCode" :disabled="accessCode.length !== 3">
          Join Game
        </base-button>
      </div>
    </div>

    <!-- Waiting for game to start -->
    <div v-else-if="state === 'waiting'" class="waiting-screen">
      <div class="team-name">{{ teamName }}</div>
      <div class="waiting-message">Waiting for game to start...</div>
      <div class="connection-status connected">Connected</div>
    </div>

    <!-- Countdown -->
    <div v-else-if="state === 'countdown'" class="countdown-screen">
      <div class="countdown-number">{{ countdownDisplay }}</div>
    </div>

    <!-- Button (GO) -->
    <div v-else-if="state === 'go'" class="go-screen">
      <button class="big-button" @click="pressButton" :disabled="pressed">
        <span v-if="!pressed">PRESS!</span>
        <span v-else>{{ displayTime }}s</span>
      </button>
      <div v-if="!pressed" class="timer">{{ elapsedDisplay }}s</div>
    </div>

    <!-- Result -->
    <div v-else-if="state === 'result'" class="result-screen">
      <div class="result-label">YOUR TIME</div>
      <div class="result-time">{{ displayTime }}s</div>
      <div class="result-points">{{ points }} points</div>
      <div class="waiting-message">Waiting for results...</div>
    </div>

    <!-- Final Results -->
    <div v-else-if="state === 'results'" class="results-screen">
      <div class="result-label">RESULTS</div>
      <div class="result-time">{{ displayTime }}s</div>
      <div class="result-points">{{ points }} points</div>
      <div v-if="confirmed" class="confirmed-message">Results saved!</div>
    </div>

    <!-- Discarded -->
    <div v-else-if="state === 'discarded'" class="discarded-screen">
      <div class="discarded-message">DISCARDED</div>
      <div class="waiting-message">Waiting for next round...</div>
    </div>

    <!-- Not Selected for this round -->
    <div v-else-if="state === 'not-selected'" class="not-selected-screen">
      <div class="team-name">{{ teamName }}</div>
      <div class="not-selected-message">Not selected for this round</div>
      <div class="waiting-message">Please wait...</div>
    </div>

    <!-- Kicked -->
    <div v-else-if="state === 'kicked'" class="kicked-screen">
      <div class="kicked-message">DISCONNECTED</div>
      <div class="kicked-reason">{{ kickReason }}</div>
      <base-button @click="resetToEntry">Try Again</base-button>
    </div>

    <!-- Lost connection -->
    <div v-else-if="state === 'lost'" class="lost-screen">
      <div class="lost-message">CONNECTION LOST</div>
      <div class="waiting-message">Reconnecting...</div>
    </div>
  </div>
</template>

<script>
import { io } from 'socket.io-client';
import { API_BASE_URL, SOCKET_URL } from '../../config.js';

export default {
  props: ['code'],
  data() {
    return {
      accessCode: '',
      state: 'entry',
      error: null,
      teamName: '',
      teamId: null,
      gameId: null,
      socket: null,
      countdownDisplay: '',
      countdownInterval: null,
      goTime: null,
      maxTimeMs: 10000,
      maxPoints: 100,
      pressed: false,
      pressTime: null,
      displayTime: '0.0',
      points: 0,
      elapsedDisplay: '0.0',
      elapsedInterval: null,
      timingMode: 'server',
      timeOffset: 0,
      kickReason: '',
      confirmed: false,
      gameState: '',
      isSelected: true,
      offlineAllowed: false,
      wakeLock: null
    };
  },
  async mounted() {
    // If code is provided in URL, use it
    if (this.code) {
      this.accessCode = this.code;
      await this.validateCode();
    }

    // Sync time with server
    await this.syncTime();

    // Re-acquire wake lock when page becomes visible
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  },
  beforeUnmount() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.cleanup();
  },
  methods: {
    handleVisibilityChange() {
      // Re-acquire wake lock when page becomes visible during active game states
      if (document.visibilityState === 'visible') {
        const activeStates = ['countdown', 'go', 'result', 'results'];
        if (activeStates.includes(this.state)) {
          this.requestWakeLock();
        }
      }
    },

    cleanup() {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }
      if (this.elapsedInterval) {
        clearInterval(this.elapsedInterval);
        this.elapsedInterval = null;
      }
      this.releaseWakeLock();
    },

    async requestWakeLock() {
      if ('wakeLock' in navigator) {
        try {
          this.wakeLock = await navigator.wakeLock.request('screen');
          console.log('Wake Lock acquired');

          // Re-acquire wake lock if released (e.g., tab becomes visible again)
          this.wakeLock.addEventListener('release', () => {
            console.log('Wake Lock released');
          });
        } catch (err) {
          console.log('Wake Lock error:', err.message);
        }
      }
    },

    releaseWakeLock() {
      if (this.wakeLock) {
        this.wakeLock.release();
        this.wakeLock = null;
        console.log('Wake Lock released manually');
      }
    },

    async syncTime() {
      try {
        const samples = [];
        for (let i = 0; i < 3; i++) {
          const t1 = Date.now();
          const response = await fetch(`${API_BASE_URL}/time-sync`);
          const t2 = Date.now();
          const data = await response.json();

          const rtt = t2 - t1;
          const offset = data.serverTime - t1 - (rtt / 2);
          samples.push({ offset, rtt });

          await new Promise(r => setTimeout(r, 100));
        }

        // Use sample with lowest RTT
        const bestSample = samples.sort((a, b) => a.rtt - b.rtt)[0];
        this.timeOffset = bestSample.offset;
        console.log('Time offset:', this.timeOffset, 'ms');
      } catch (error) {
        console.error('Time sync failed:', error);
      }
    },

    getServerTime() {
      return Date.now() + this.timeOffset;
    },

    async validateCode() {
      if (this.accessCode.length !== 3) {
        this.error = 'Please enter a 3-digit code';
        return;
      }

      this.error = null;

      try {
        const response = await fetch(`${API_BASE_URL}/teamboard/validate/${this.accessCode}`);
        const data = await response.json();

        if (!response.ok) {
          this.error = data.message || 'Invalid code';
          return;
        }

        this.gameId = data.gameId;
        this.teamId = data.teamId;
        this.teamName = data.teamName;
        this.maxPoints = data.maxPoints || 100;
        this.timingMode = data.timingMode || 'server';

        // Connect via WebSocket
        this.connectSocket();
      } catch (error) {
        console.error('Validation error:', error);
        this.error = `Failed to validate code. API: ${API_BASE_URL}. Error: ${error.message}`;
      }
    },

    connectSocket() {
      this.socket = io(SOCKET_URL);

      this.socket.on('connect', () => {
        console.log('Socket connected');
        this.socket.emit('team:join', {
          code: this.accessCode,
          gameId: this.gameId
        });
      });

      this.socket.on('team:validated', (data) => {
        console.log('Team validated:', data);
        this.teamName = data.teamName;
        this.isSelected = data.isSelected !== false;
        this.offlineAllowed = data.offlineAllowed || false;
        this.state = 'waiting';
        this.gameState = 'waiting';
      });

      this.socket.on('team:selected', (data) => {
        console.log('Selection changed:', data);
        this.isSelected = data.isSelected;
      });

      this.socket.on('team:settings', (data) => {
        console.log('Settings changed:', data);
        if (data.offlineAllowed !== undefined) {
          this.offlineAllowed = data.offlineAllowed;
        }
      });

      // Handle state restoration on reconnect
      this.socket.on('team:state', (data) => {
        console.log('Team state received:', data);

        // Check if we're selected for this round
        if (data.selectedTeams && !data.selectedTeams.includes(this.teamId)) {
          this.isSelected = false;
          this.state = 'not-selected';
          this.gameState = 'not-selected';
          return;
        }

        this.isSelected = true;
        this.goTime = data.goTime;
        this.maxTimeMs = data.maxTimeMs;

        // If we already have a result (pressed or manual capture)
        if (data.result) {
          this.pressed = true;
          this.displayTime = data.result.displayTime;
          this.points = data.result.points;
          this.state = 'result';
          this.gameState = 'result';
          this.requestWakeLock();
          return;
        }

        // Set state based on current phase
        if (data.phase === 'running') {
          this.state = 'go';
          this.gameState = 'go';
          this.pressed = false;
          this.startElapsedTimer();
          this.requestWakeLock();
        } else if (data.phase === 'countdown') {
          this.state = 'countdown';
          this.gameState = 'countdown';
          this.requestWakeLock();
        } else if (data.phase === 'completed') {
          this.state = 'waiting';
          this.gameState = 'waiting';
        }
      });

      // Handle when moderator captures time for this team (or any team pressed)
      this.socket.on('team:pressed', (data) => {
        console.log('Team pressed event:', data);
        // Check if this is our own result (manual capture by moderator)
        if (data.teamId === this.teamId && !this.pressed) {
          this.pressed = true;
          this.displayTime = data.displayTime;
          this.points = data.points;
          this.state = 'result';
          this.gameState = 'result';
          this.stopElapsedTimer();
        }
      });

      this.socket.on('team:rejected', (data) => {
        console.log('Team rejected:', data);
        this.error = data.reason;
        this.state = 'entry';
      });

      this.socket.on('game:countdown', (data) => {
        console.log('Countdown started:', data);
        this.pressed = false;
        this.goTime = data.startsAt;
        this.maxTimeMs = data.maxTimeMs;

        // Check if this team is selected for this round
        if (data.selectedTeams && !data.selectedTeams.includes(this.teamId)) {
          this.isSelected = false;
          this.state = 'not-selected';
          this.gameState = 'not-selected';
          return;
        }

        this.isSelected = true;
        this.state = 'countdown';
        this.gameState = 'countdown';

        // Request wake lock to keep screen on
        this.requestWakeLock();

        // Start countdown display
        this.startCountdown(data.startsAt, data.serverTime);
      });

      this.socket.on('game:go', (data) => {
        console.log('GO!', data);
        // Don't change state if not selected
        if (!this.isSelected) return;

        this.state = 'go';
        this.gameState = 'go';
        this.goTime = data.goTime;
        this.maxTimeMs = data.maxTimeMs;

        // Ensure wake lock is active
        this.requestWakeLock();

        // Start elapsed timer
        this.startElapsedTimer();
      });

      this.socket.on('press:confirmed', (data) => {
        console.log('Press confirmed:', data);
        this.displayTime = data.displayTime;
        this.points = data.points;
        this.state = 'result';
        this.gameState = 'result';
        this.stopElapsedTimer();
      });

      this.socket.on('press:rejected', (data) => {
        console.log('Press rejected:', data);
      });

      this.socket.on('game:results', (data) => {
        console.log('Results:', data);
        // If not selected, just return to waiting
        if (!this.isSelected || this.state === 'not-selected') {
          this.state = 'waiting';
          this.gameState = 'waiting';
          this.isSelected = true;
          return;
        }

        // Find our result
        const myResult = data.results.find(r => r.teamId === this.teamId);
        if (myResult) {
          this.displayTime = (myResult.reactionTimeMs / 1000).toFixed(1);
          this.points = myResult.points;
        }
        this.state = 'results';
        this.gameState = 'results';
      });

      this.socket.on('game:confirmed', () => {
        console.log('Results confirmed');
        this.confirmed = true;
      });

      this.socket.on('game:discarded', () => {
        console.log('Round discarded');
        // Only show discarded if this team was participating
        if (this.isSelected && this.state !== 'not-selected') {
          this.state = 'discarded';
          this.gameState = 'discarded';
        }
        this.stopElapsedTimer();
        this.pressed = false;

        // Return to waiting after 2 seconds
        setTimeout(() => {
          this.state = 'waiting';
          this.gameState = 'waiting';
          this.confirmed = false;
          this.isSelected = true; // Reset selection for next round
          this.releaseWakeLock();
        }, 2000);
      });

      this.socket.on('team:kicked', (data) => {
        console.log('Kicked:', data);
        this.kickReason = data.reason;
        this.state = 'kicked';
        this.gameState = 'kicked';
        this.cleanup();
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected');
        if (this.state !== 'kicked' && this.state !== 'entry') {
          this.state = 'lost';
          this.gameState = 'lost';
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        this.error = 'Failed to connect';
        this.state = 'entry';
      });
    },

    startCountdown(startsAt) {
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }

      const updateCountdown = () => {
        const now = this.getServerTime();
        const remaining = Math.ceil((startsAt - now) / 1000);

        if (remaining <= 0) {
          this.countdownDisplay = 'GO!';
          clearInterval(this.countdownInterval);
        } else {
          this.countdownDisplay = remaining.toString();
        }
      };

      updateCountdown();
      this.countdownInterval = setInterval(updateCountdown, 100);
    },

    startElapsedTimer() {
      if (this.elapsedInterval) {
        clearInterval(this.elapsedInterval);
      }

      const updateElapsed = () => {
        if (this.pressed) return;

        const now = this.getServerTime();
        const elapsed = Math.max(0, now - this.goTime);
        this.elapsedDisplay = (elapsed / 1000).toFixed(1);

        if (elapsed >= this.maxTimeMs) {
          this.elapsedDisplay = (this.maxTimeMs / 1000).toFixed(1);
          clearInterval(this.elapsedInterval);
        }
      };

      updateElapsed();
      this.elapsedInterval = setInterval(updateElapsed, 50);
    },

    stopElapsedTimer() {
      if (this.elapsedInterval) {
        clearInterval(this.elapsedInterval);
        this.elapsedInterval = null;
      }
    },

    pressButton() {
      if (this.pressed || this.state !== 'go') return;

      this.pressed = true;
      this.pressTime = this.getServerTime();

      const elapsed = this.pressTime - this.goTime;
      this.displayTime = (elapsed / 1000).toFixed(1);

      // Send to server
      this.socket.emit('team:press', {
        pressTime: this.pressTime
      });

      this.stopElapsedTimer();
    },

    resetToEntry() {
      this.cleanup();
      this.accessCode = '';
      this.state = 'entry';
      this.gameState = '';
      this.error = null;
      this.pressed = false;
      this.confirmed = false;
    }
  }
};
</script>

<style scoped>
.team-board {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #1a1a2e;
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 1rem;
  box-sizing: border-box;
}

.team-board.waiting {
  background: #1a1a2e;
}

.team-board.countdown {
  background: #16213e;
}

.team-board.go {
  background: #0f3460;
}

.team-board.result,
.team-board.results {
  background: #1a1a2e;
}

.team-board.discarded {
  background: #4a1942;
}

.team-board.kicked,
.team-board.lost {
  background: #3d0000;
}

.team-board.not-selected {
  background: #2d3436;
}

/* Entry Screen */
.entry-screen {
  width: 100%;
  max-width: 400px;
}

.entry-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
}

.entry-card h1 {
  font-size: 1.5rem;
  margin-bottom: 2rem;
}

.code-input-wrapper {
  margin-bottom: 1.5rem;
}

.code-input {
  width: 100%;
  max-width: 200px;
  font-size: 3rem;
  text-align: center;
  padding: 1rem;
  border: none;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  color: #1a1a2e;
  letter-spacing: 0.5rem;
  font-weight: bold;
}

.code-input:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
}

.error-message {
  color: #ff6b6b;
  margin-bottom: 1rem;
}

/* Waiting Screen */
.waiting-screen {
  text-align: center;
}

.team-name {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 1rem;
}

.waiting-message {
  font-size: 1.2rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 1rem;
}

.connection-status {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
}

.connection-status.connected {
  background: #28a745;
}

/* Countdown Screen */
.countdown-screen {
  text-align: center;
}

.countdown-number {
  font-size: 15rem;
  font-weight: bold;
  line-height: 1;
  text-shadow: 0 0 50px rgba(255, 255, 255, 0.5);
}

/* GO Screen */
.go-screen {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 2rem;
}

.big-button {
  width: 80vmin;
  height: 80vmin;
  max-width: 500px;
  max-height: 500px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(145deg, #e74c3c, #c0392b);
  color: white;
  font-size: 4rem;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3),
              inset 0 -5px 20px rgba(0, 0, 0, 0.2);
  transition: transform 0.1s, box-shadow 0.1s;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.big-button:active:not(:disabled) {
  transform: scale(0.95);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3),
              inset 0 5px 20px rgba(0, 0, 0, 0.2);
}

.big-button:disabled {
  background: linear-gradient(145deg, #27ae60, #1e8449);
  cursor: default;
}

.timer {
  font-size: 3rem;
  margin-top: 2rem;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.8);
}

/* Result Screens */
.result-screen,
.results-screen {
  text-align: center;
}

.result-label {
  font-size: 1.2rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 0.5rem;
}

.result-time {
  font-size: 6rem;
  font-weight: bold;
  line-height: 1.2;
}

.result-points {
  font-size: 2rem;
  color: #27ae60;
  margin-bottom: 1rem;
}

.confirmed-message {
  color: #27ae60;
  font-size: 1.2rem;
  margin-top: 1rem;
}

/* Discarded Screen */
.discarded-screen {
  text-align: center;
}

.discarded-message {
  font-size: 4rem;
  font-weight: bold;
  color: #e74c3c;
  margin-bottom: 1rem;
}

/* Not Selected Screen */
.not-selected-screen {
  text-align: center;
}

.not-selected-message {
  font-size: 2rem;
  font-weight: bold;
  color: #95a5a6;
  margin-bottom: 1rem;
}

/* Kicked Screen */
.kicked-screen,
.lost-screen {
  text-align: center;
}

.kicked-message,
.lost-message {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 1rem;
}

.kicked-reason {
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2rem;
}

/* Mobile optimizations */
@media (max-width: 480px) {
  .countdown-number {
    font-size: 10rem;
  }

  .big-button {
    font-size: 3rem;
  }

  .result-time {
    font-size: 4rem;
  }

  .timer {
    font-size: 2rem;
  }
}

@media (max-height: 600px) {
  .countdown-number {
    font-size: 8rem;
  }

  .big-button {
    width: 60vmin;
    height: 60vmin;
    font-size: 2.5rem;
  }
}
</style>
