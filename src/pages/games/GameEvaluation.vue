<template>
  <div>
    <base-dialog :show="!!error" title="An error occurred!" @close="handleError">
      <p>{{ error }}</p>
    </base-dialog>
    <base-dialog :show="showStatusConfirm" :title="statusConfirmTitle" @close="cancelStatusChange">
      <p>{{ statusConfirmMessage }}</p>
      <template #actions>
        <base-button mode="flat" @click="cancelStatusChange">Cancel</base-button>
        <base-button @click="confirmStatusChange">Confirm</base-button>
      </template>
    </base-dialog>
    <base-dialog :show="showPastEditWarning" title="Warning: Editing Past Game" @close="closePastWarning">
      <p>This game has already ended. Are you sure you want to edit the scores?</p>
      <template #actions>
        <base-button mode="flat" @click="closePastWarning">Cancel</base-button>
        <base-button @click="confirmPastEdit">Continue Editing</base-button>
      </template>
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
            <div class="points-range">
              <span>Points Range: {{ game.minimumPoint }} - {{ game.maximumPoint }}</span>
            </div>
            <div class="status-badge" :class="`status-${game.status}`">
              {{ getStatusLabel(game.status) }}
            </div>
          </div>
          <div class="status-actions" v-if="isAdmin">
            <base-button v-if="game.status === 'coming'" @click="showStatusDialog('running')">Start Game</base-button>
            <base-button v-if="game.status === 'running'" @click="showStatusDialog('past')">Finish Game</base-button>
            <base-button v-if="game.status === 'past'" mode="outline" @click="showStatusDialog('running')">Replay Game</base-button>
          </div>
        </div>

        <div class="teams-scores" v-if="groupTeams.length > 0">
          <h3>Team Scores</h3>
          <ul class="teams-list">
            <li v-for="team in groupTeams" :key="team.id" class="team-score-item">
              <div class="team-name">
                <h4>{{ team.name }}</h4>
                <p>{{ team.description }}</p>
              </div>
              <div class="score-input">
                <label :for="`score-${team.id}`">Points:</label>
                <input
                  :id="`score-${team.id}`"
                  type="number"
                  :min="game.minimumPoint"
                  :max="game.maximumPoint"
                  v-model.number="teamScores[team.id]"
                  @change="saveTeamScore(team.id)"
                  @blur="saveTeamScore(team.id)"
                  @keyup.enter="saveTeamScore(team.id)"
                  :class="{ invalid: !isValidScore(teamScores[team.id]) }"
                />
                <span v-if="!isValidScore(teamScores[team.id])" class="error-text">
                  Must be between {{ game.minimumPoint }} and {{ game.maximumPoint }}
                </span>
              </div>
            </li>
          </ul>
        </div>
        <div v-else class="no-teams">
          <p>No teams in this gaming group yet.</p>
        </div>

        <!-- Child route for time-based games (only show when game is running) -->
        <router-view v-if="game.status === 'running'" @scores-updated="loadGameScores"></router-view>

        <!-- Message for time-based games that are not running -->
        <div v-else-if="game.gameType === 'time'" class="time-game-status-info">
          <p v-if="game.status === 'coming'">
            Start the game to enable time-based evaluation controls.
          </p>
          <p v-else-if="game.status === 'past'">
            This time-based game has ended. Scores are finalized above.
          </p>
        </div>
      </base-card>
    </section>
    <base-spinner v-else></base-spinner>
  </div>
</template>

<script>
import { API_BASE_URL } from '../../config.js';
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
      teamScores: {},
      gameScores: [],
      showStatusConfirm: false,
      pendingStatus: null,
      statusConfirmTitle: '',
      statusConfirmMessage: '',
      showPastEditWarning: false,
      pastWarningShown: false
    };
  },
  computed: {
    isAdmin() {
      return this.$store.getters['auth/isAdministrator'];
    }
  },
  async created() {
    await this.loadData();

    // Navigate to time child route if game is time-based
    if (this.game && this.game.gameType === 'time' && !this.$route.path.endsWith('/time')) {
      this.$router.replace(`/games/${this.id}/time`);
    }

    if (this.game && this.game.status === 'past' && !this.pastWarningShown) {
      this.showPastEditWarning = true;
    }
  },
  methods: {
    async loadData() {
      this.isLoading = true;
      try {
        await this.$store.dispatch('games/loadGames', { forceRefresh: true });
        this.game = this.$store.getters['games/getGameById'](parseInt(this.id));

        if (!this.game) {
          this.$router.replace('/games');
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

        // Initialize scores with minimum points for teams that don't have scores yet
        this.groupTeams.forEach(team => {
          const existingScore = this.gameScores.find(s => s.teamId === team.id);
          this.teamScores[team.id] = existingScore ? existingScore.score : this.game.minimumPoint;
        });
      } catch (error) {
        console.error('Failed to load group teams:', error);
        this.groupTeams = [];
      }
    },
    async loadGameScores() {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/games/${this.id}/scores`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          this.gameScores = await response.json();
          // Update teamScores with loaded scores
          this.gameScores.forEach(score => {
            this.teamScores[score.teamId] = score.score;
          });
        }
      } catch (error) {
        console.error('Failed to load game scores:', error);
      }
    },
    isValidScore(score) {
      return score >= this.game.minimumPoint && score <= this.game.maximumPoint;
    },
    async saveTeamScore(teamId) {
      const score = this.teamScores[teamId];

      if (!this.isValidScore(score)) {
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/games/${this.id}/scores`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            teamId: teamId,
            score: score
          })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to save score');
        }
      } catch (error) {
        this.error = error.message || 'Failed to save team score';
      }
    },
    showStatusDialog(newStatus) {
      this.pendingStatus = newStatus;

      if (newStatus === 'running' && this.game.status === 'coming') {
        this.statusConfirmTitle = 'Start Game';
        this.statusConfirmMessage = 'Are you sure you want to start this game? It will become live and visible to all users.';
      } else if (newStatus === 'past' && this.game.status === 'running') {
        this.statusConfirmTitle = 'Finish Game';
        this.statusConfirmMessage = 'Are you sure you want to finish this game? Scores will be finalized.';
      } else if (newStatus === 'running' && this.game.status === 'past') {
        this.statusConfirmTitle = 'Replay Game';
        this.statusConfirmMessage = 'Are you sure you want to replay this game? It will become active again.';
      }

      this.showStatusConfirm = true;
    },
    cancelStatusChange() {
      this.showStatusConfirm = false;
      this.pendingStatus = null;
    },
    async confirmStatusChange() {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/games/${this.id}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            status: this.pendingStatus
          })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to update game status');
        }

        this.game.status = this.pendingStatus;
        this.showStatusConfirm = false;
        this.pendingStatus = null;

        // Refresh game data
        await this.$store.dispatch('games/loadGames', { forceRefresh: true });
        this.game = this.$store.getters['games/getGameById'](parseInt(this.id));
      } catch (error) {
        this.error = error.message || 'Failed to update game status';
      }
    },
    closePastWarning() {
      this.$router.back();
    },
    confirmPastEdit() {
      this.pastWarningShown = true;
      this.showPastEditWarning = false;
    },
    getStatusLabel(status) {
      const labels = {
        coming: 'Coming Soon',
        running: 'Live',
        past: 'Finished'
      };
      return labels[status] || status;
    },
    handleError() {
      this.error = null;
    }
  }
};
</script>

<style scoped>
.game-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #e0e0e0;
}

.game-info {
  flex: 1;
}

.game-info h2 {
  font-size: 2rem;
  margin: 0 0 1rem 0;
}

.description {
  color: #666;
  font-size: 1.1rem;
  line-height: 1.6;
  margin: 0 0 1rem 0;
}

.points-range {
  margin: 1rem 0;
  padding: 0.5rem 1rem;
  background: #f0e6fd;
  border-radius: 8px;
  display: inline-block;
  font-weight: 500;
  color: #3d008d;
}

.status-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  font-weight: bold;
  text-transform: uppercase;
  font-size: 0.85rem;
  margin-top: 1rem;
}

.status-coming {
  background-color: #3d008d;
  color: white;
}

.status-running {
  background-color: #28a745;
  color: white;
}

.status-past {
  background-color: #6c757d;
  color: white;
}

.status-actions {
  display: flex;
  gap: 0.5rem;
}

.teams-scores {
  margin-top: 2rem;
}

.teams-scores h3 {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  color: #3d008d;
}

.teams-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.team-score-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  margin-bottom: 1rem;
  background: #f9f9f9;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.team-name {
  flex: 1;
}

.team-name h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.2rem;
}

.team-name p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.score-input {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.score-input label {
  font-weight: bold;
  font-size: 0.9rem;
  color: #666;
}

.score-input input {
  width: 120px;
  padding: 0.5rem;
  border: 2px solid #ccc;
  border-radius: 4px;
  font: inherit;
  font-size: 1.1rem;
  text-align: center;
}

.score-input input:focus {
  outline: none;
  border-color: #3d008d;
  background-color: #f0e6fd;
}

.score-input input.invalid {
  border-color: #dc3545;
  background-color: #ffe6e6;
}

.error-text {
  color: #dc3545;
  font-size: 0.75rem;
  font-weight: 500;
}

.no-teams {
  text-align: center;
  padding: 3rem;
  color: #666;
  font-style: italic;
}

.time-game-status-info {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f5f5f5;
  border-radius: 8px;
  text-align: center;
  color: #666;
  border: 1px dashed #ccc;
}

.time-game-status-info p {
  margin: 0;
  font-size: 1rem;
}

@media (max-width: 768px) {
  .game-header {
    flex-direction: column;
    gap: 1rem;
  }

  .game-info h2 {
    font-size: 1.5rem;
  }

  .description {
    font-size: 1rem;
  }

  .status-actions {
    width: 100%;
    flex-direction: column;
  }

  .status-actions button {
    width: 100%;
  }

  .team-score-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .score-input {
    width: 100%;
    align-items: stretch;
  }

  .score-input input {
    width: 100%;
  }

  .teams-scores h3 {
    font-size: 1.25rem;
  }
}

@media (max-width: 480px) {
  .game-info h2 {
    font-size: 1.25rem;
  }

  .description {
    font-size: 0.95rem;
  }

  .points-range {
    font-size: 0.9rem;
    padding: 0.4rem 0.75rem;
  }

  .status-badge {
    font-size: 0.75rem;
    padding: 0.4rem 0.75rem;
  }

  .team-score-item {
    padding: 1rem;
  }

  .team-name h4 {
    font-size: 1.1rem;
  }

  .team-name p {
    font-size: 0.85rem;
  }

  .no-teams {
    padding: 2rem 1rem;
  }
}
</style>
