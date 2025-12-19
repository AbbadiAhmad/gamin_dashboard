<template>
  <div>
    <base-dialog :show="!!error" title="An error occurred!" @close="handleError">
      <p>{{ error }}</p>
    </base-dialog>
    <transition name="toast">
      <div v-if="toastMessage" class="toast-message">
        {{ toastMessage }}
      </div>
    </transition>
    <base-dialog :show="showAddTeamDialog" title="Add Team to Group" @close="closeAddTeamDialog">
      <div class="add-team-dialog">
        <div class="form-control">
          <label for="team-select">Select Team</label>
          <select id="team-select" v-model="selectedTeamId">
            <option value="">-- Select a team --</option>
            <option v-for="team in availableTeams" :key="team.id" :value="team.id">
              {{ team.name }}
            </option>
          </select>
        </div>
      </div>
      <template #actions>
        <base-button mode="flat" @click="closeAddTeamDialog">Cancel</base-button>
        <base-button @click="addTeamToGroup">Add Team</base-button>
      </template>
    </base-dialog>
    <section v-if="!isLoading">
      <base-card>
        <div class="tabs">
          <button
            :class="{ active: activeTab === 'info' }"
            @click="activeTab = 'info'"
          >
            Group Info
          </button>
          <button
            :class="{ active: activeTab === 'teams' }"
            @click="activeTab = 'teams'"
          >
            Teams
          </button>
          <button
            :class="{ active: activeTab === 'games' }"
            @click="activeTab = 'games'"
          >
            Games
          </button>
        </div>

        <div class="tab-content">
          <!-- Group Info Tab -->
          <div v-if="activeTab === 'info'" class="info-tab">
            <div class="action-buttons">
              <base-button v-if="isAdmin" mode="outline" link :to="editLink">Edit Info</base-button>
              <base-button v-if="isAdmin" mode="flat" @click="deleteGroup">Delete Group</base-button>
            </div>
            <h2>{{ group.name }}</h2>
            <p class="description">{{ group.description }}</p>
          </div>

          <!-- Teams Tab -->
          <div v-if="activeTab === 'teams'" class="teams-tab">
            <div class="action-buttons">
              <base-button v-if="isAdmin" @click="showAddTeamDialog = true">Add Team to Group</base-button>
              <base-button v-if="isAdmin" mode="outline" @click="calculateScores">Calculate Scores</base-button>
            </div>
            <div v-if="groupTeams.length > 0">
              <ul class="teams-list">
                <li v-for="team in sortedGroupTeams" :key="team.id" class="team-item">
                  <div class="team-info">
                    <h4>{{ team.name }}</h4>
                    <p>{{ team.description }}</p>
                  </div>
                  <div class="team-score">
                    <span class="score-label">Score:</span>
                    <span class="score-value">{{ team.score || 0 }}</span>
                  </div>
                  <div class="team-actions" v-if="isAdmin">
                    <base-button mode="flat" @click="removeTeamFromGroup(team.id)">Remove</base-button>
                  </div>
                </li>
              </ul>
            </div>
            <p v-else class="empty-message">No teams added to this group yet.</p>
          </div>

          <!-- Games Tab -->
          <div v-if="activeTab === 'games'" class="games-tab">
            <div class="action-buttons">
              <base-button v-if="isAdmin" link :to="addGameLink">Add Game</base-button>
            </div>
            <div v-if="games.length > 0">
              <ul @drop="onDrop" @dragover.prevent class="games-list">
                <li
                  v-for="(game, index) in sortedGames"
                  :key="game.id"
                  :draggable="isAdmin"
                  @dragstart="onDragStart(index, $event)"
                  @dragend="onDragEnd"
                  @click="goToGame(game.id)"
                  class="game-item clickable"
                  :class="{ dragging: dragIndex === index }"
                >
                  <div class="game-info">
                    <h4>{{ game.name }}</h4>
                    <p>{{ game.description }}</p>
                    <span class="points">Points: {{ game.minimumPoint }} - {{ game.maximumPoint }}</span>
                  </div>
                  <span class="game-status" :class="`status-${game.status}`">
                    {{ getStatusLabel(game.status) }}
                  </span>
                  <div class="game-actions" @click.stop>
                    <base-button mode="outline" link :to="`/games/${game.id}`">Evaluate</base-button>
                    <base-button v-if="isAdmin" mode="outline" link :to="`/games/${game.id}/edit`">Edit</base-button>
                    <base-button v-if="isAdmin" mode="flat" @click="deleteGame(game.id)">Delete</base-button>
                  </div>
                </li>
              </ul>
            </div>
            <p v-else class="empty-message">No games in this group yet.</p>
          </div>
        </div>
      </base-card>
    </section>
    <base-spinner v-else></base-spinner>
  </div>
</template>

<script>
import { API_BASE_URL } from '../../config.js';

export default {
  props: ['id'],
  data() {
    return {
      isLoading: false,
      error: null,
      toastMessage: null,
      activeTab: 'games',
      groupTeams: [],
      dragIndex: null,
      localGames: [],
      showAddTeamDialog: false,
      selectedTeamId: ''
    };
  },
  computed: {
    isAdmin() {
      return this.$store.getters['auth/isAdministrator'];
    },
    group() {
      return this.$store.getters['gamingGroups/getGroupById'](parseInt(this.id));
    },
    games() {
      return this.$store.getters['games/getGamesByGroupId'](parseInt(this.id));
    },
    sortedGames() {
      return this.localGames.length > 0 ? this.localGames : [...this.games].sort((a, b) => a.displayOrder - b.displayOrder);
    },
    sortedGroupTeams() {
      return [...this.groupTeams].sort((a, b) => b.score - a.score);
    },
    editLink() {
      return `/gaming-groups/${this.id}/edit`;
    },
    addGameLink() {
      return `/games/new?groupId=${this.id}`;
    },
    allTeams() {
      return this.$store.getters['teams/teams'];
    },
    availableTeams() {
      const groupTeamIds = this.groupTeams.map(t => t.id);
      return this.allTeams.filter(team => !groupTeamIds.includes(team.id));
    }
  },
  watch: {
    games: {
      handler(newGames) {
        this.localGames = [...newGames].sort((a, b) => a.displayOrder - b.displayOrder);
      },
      immediate: true,
      deep: true
    }
  },
  async created() {
    await this.loadData();
    // Automatically calculate scores when entering the page
    if (this.isAdmin) {
      await this.calculateScoresQuietly();
    }
  },
  methods: {
    async loadData() {
      this.isLoading = true;
      try {
        await this.$store.dispatch('gamingGroups/loadGroups', { forceRefresh: true });
        await this.$store.dispatch('games/loadGames', { forceRefresh: true });
        await this.$store.dispatch('teams/loadTeams', { forceRefresh: true });
        await this.loadGroupTeams();
      } catch (error) {
        this.error = error.message || 'Failed to load data';
      }
      this.isLoading = false;
    },
    async loadGroupTeams() {
      try {
        this.groupTeams = await this.$store.dispatch('teams/loadGroupTeams', { groupId: this.id });
      } catch (error) {
        console.error('Failed to load group teams:', error);
        this.groupTeams = [];
      }
    },
    async deleteGroup() {
      if (!confirm('Are you sure you want to delete this gaming group?')) {
        return;
      }
      try {
        await this.$store.dispatch('gamingGroups/deleteGroup', this.id);
        this.$router.replace('/gaming-groups');
      } catch (error) {
        this.error = error.message || 'Failed to delete group';
      }
    },
    async deleteGame(gameId) {
      if (!confirm('Are you sure you want to delete this game? This will also delete all associated scores and scoring configurations.')) {
        return;
      }
      try {
        await this.$store.dispatch('games/deleteGame', { id: gameId });
        await this.loadData();
        await this.calculateScoresQuietly();
        this.showToast('Game deleted successfully');
      } catch (error) {
        this.error = error.message || 'Failed to delete game';
      }
    },
    async addTeamToGroup() {
      if (!this.selectedTeamId) {
        alert('Please select a team');
        return;
      }
      try {
        await this.$store.dispatch('teams/addTeamToGroup', {
          groupId: this.id,
          teamId: this.selectedTeamId,
          score: 0
        });
        await this.loadGroupTeams();
        this.closeAddTeamDialog();
      } catch (error) {
        this.error = error.message || 'Failed to add team to group';
      }
    },
    async removeTeamFromGroup(teamId) {
      if (!confirm('Are you sure you want to remove this team from the group?')) {
        return;
      }
      try {
        await this.$store.dispatch('teams/removeTeamFromGroup', {
          groupId: this.id,
          teamId: teamId
        });
        await this.loadGroupTeams();
      } catch (error) {
        this.error = error.message || 'Failed to remove team from group';
      }
    },
    async calculateScores() {
      try {
        const response = await fetch(`${API_BASE_URL}/gaming-groups/${this.id}/calculate-scores`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.$store.getters['auth/token']}`
          }
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to calculate scores');
        }

        await this.loadGroupTeams();
        this.showToast('Team scores calculated successfully');
      } catch (error) {
        this.error = error.message || 'Failed to calculate team scores';
      }
    },
    async calculateScoresQuietly() {
      try {
        const response = await fetch(`${API_BASE_URL}/gaming-groups/${this.id}/calculate-scores`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.$store.getters['auth/token']}`
          }
        });

        if (response.ok) {
          await this.loadGroupTeams();
        }
      } catch (error) {
        // Silently fail for automatic background calculation
        console.error('Background score calculation failed:', error);
      }
    },
    closeAddTeamDialog() {
      this.showAddTeamDialog = false;
      this.selectedTeamId = '';
    },
    getStatusLabel(status) {
      const labels = {
        coming: 'Coming',
        running: 'Running',
        past: 'Past'
      };
      return labels[status] || status;
    },
    goToGame(gameId) {
      this.$router.push(`/games/${gameId}`);
    },
    onDragStart(index, event) {
      this.dragIndex = index;
      event.dataTransfer.effectAllowed = 'move';
    },
    onDragEnd() {
      this.dragIndex = null;
    },
    onDrop(event) {
      event.preventDefault();
      const dropIndex = this.getDropIndex(event);

      if (dropIndex !== null && this.dragIndex !== null && dropIndex !== this.dragIndex) {
        const draggedGame = this.localGames[this.dragIndex];
        this.localGames.splice(this.dragIndex, 1);
        this.localGames.splice(dropIndex, 0, draggedGame);

        const gameOrders = this.localGames.map((game, index) => ({
          id: game.id,
          displayOrder: index
        }));

        this.$store.dispatch('games/reorderGames', { gameOrders });
      }
    },
    getDropIndex(event) {
      const items = Array.from(event.currentTarget.querySelectorAll('.game-item'));
      const y = event.clientY;

      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        if (y < rect.top + rect.height / 2) {
          return i;
        }
      }
      return items.length;
    },
    handleError() {
      this.error = null;
    },
    showToast(message) {
      this.toastMessage = message;
      setTimeout(() => {
        this.toastMessage = null;
      }, 3000);
    }
  }
};
</script>

<style scoped>
.tabs {
  display: flex;
  border-bottom: 2px solid #e0e0e0;
  margin-bottom: 2rem;
}

.tabs button {
  padding: 1rem 2rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font: inherit;
  font-weight: 500;
  color: #666;
  transition: all 0.2s;
}

.tabs button:hover {
  color: #3d008d;
  background: #f9f9f9;
}

.tabs button.active {
  color: #3d008d;
  border-bottom-color: #3d008d;
}

.tab-content {
  padding: 1rem 0;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.info-tab h2 {
  font-size: 2rem;
  margin: 1rem 0;
}

.description {
  color: #666;
  font-size: 1.1rem;
  line-height: 1.6;
}

.teams-list,
.games-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.team-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  margin-bottom: 1rem;
  background: #f9f9f9;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.team-info {
  flex: 1;
}

.team-info h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.2rem;
}

.team-info p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.team-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 1rem;
  background: #3d008d;
  color: white;
  border-radius: 8px;
}

.score-label {
  font-size: 0.8rem;
  text-transform: uppercase;
}

.score-value {
  font-size: 1.5rem;
  font-weight: bold;
}

.team-actions {
  display: flex;
  gap: 0.5rem;
}

.game-item.clickable {
  cursor: pointer;
}

.game-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  margin-bottom: 1rem;
  background: #f9f9f9;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  transition: all 0.2s;
}

.game-item:hover {
  background: #f0f0f0;
  cursor: move;
}

.game-item.dragging {
  opacity: 0.5;
}

.game-info {
  flex: 1;
}

.game-info h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.2rem;
}

.game-info p {
  margin: 0 0 0.5rem 0;
  color: #666;
  font-size: 0.9rem;
}

.points {
  color: #3d008d;
  font-weight: 500;
  font-size: 0.9rem;
}

.game-status {
  padding: 0.4rem 0.8rem;
  border-radius: 12px;
  font-weight: bold;
  text-transform: uppercase;
  font-size: 0.75rem;
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

.game-actions {
  display: flex;
  gap: 0.5rem;
}

.empty-message {
  color: #666;
  font-style: italic;
  text-align: center;
  padding: 2rem;
}

.add-team-dialog {
  padding: 1rem 0;
}

.form-control {
  margin: 1rem 0;
}

.form-control label {
  display: block;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.form-control select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font: inherit;
}

.form-control select:focus {
  outline: none;
  border-color: #3d008d;
  background-color: #f0e6fd;
}

.toast-message {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  background-color: #3d008d;
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  font-weight: 500;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(1rem);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-1rem);
}
</style>
