<template>
  <div>
    <base-dialog :show="!!error" title="An error occurred!" @close="handleError">
      <p>{{ error }}</p>
    </base-dialog>
    <section v-if="!isLoading">
      <div class="dashboard-header">
        <h1>Gaming Groups Dashboard</h1>
        <p class="subtitle">Live team rankings and scores</p>
      </div>

      <div v-if="gamingGroups.length > 0" class="groups-container">
        <div v-for="group in gamingGroups" :key="group.id" class="group-card">
          <base-card>
            <div class="group-header">
              <h2>{{ group.name }}</h2>
              <p class="group-description">{{ group.description }}</p>
            </div>

            <div v-if="group.teams && group.teams.length > 0" class="teams-leaderboard">
              <div class="leaderboard-header">
                <span class="rank-col">Rank</span>
                <span class="team-col">Team</span>
                <span class="score-col">Score</span>
              </div>
              <div
                v-for="(team, index) in group.teams"
                :key="team.id"
                class="leaderboard-row"
                :class="{ 'top-three': getTeamRank(group.teams, index) <= 3 }"
              >
                <span class="rank-col">
                  <span class="rank-badge" :class="`rank-${getTeamRank(group.teams, index)}`">
                    {{ getTeamRank(group.teams, index) }}
                  </span>
                </span>
                <span class="team-col">
                  <span class="team-name">{{ team.name }}</span>
                  <span v-if="team.description" class="team-desc">{{ team.description }}</span>
                </span>
                <span class="score-col">
                  <span class="score-value">{{ team.score || 0 }}</span>
                </span>
              </div>
            </div>
            <p v-else class="no-teams">No teams in this group yet</p>
          </base-card>
        </div>
      </div>
      <div v-else class="empty-state">
        <base-card>
          <p>No gaming groups are currently being shown on the dashboard.</p>
        </base-card>
      </div>
    </section>
    <base-spinner v-else></base-spinner>
  </div>
</template>

<script>
export default {
  data() {
    return {
      isLoading: false,
      error: null,
      gamingGroups: [],
      refreshInterval: null
    };
  },
  async created() {
    await this.loadDashboard(true); // Initial load with loading spinner
    // Refresh every 10 seconds in background
    this.refreshInterval = setInterval(() => {
      this.loadDashboard(false); // Background updates without loading spinner
    }, 10000);
  },
  beforeUnmount() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  },
  methods: {
    getTeamRank(teams, currentIndex) {
      // Calculate the actual rank considering ties
      // Teams with the same score get the same rank
      const currentScore = teams[currentIndex].score || 0;
      let rank = 1;

      for (let i = 0; i < currentIndex; i++) {
        const previousScore = teams[i].score || 0;
        if (previousScore > currentScore) {
          rank++;
        }
      }

      return rank;
    },
    async loadDashboard(showLoading = false) {
      if (showLoading) {
        this.isLoading = true;
      }

      try {
        const response = await fetch('http://localhost:3000/dashboard/gaming-groups');

        if (!response.ok) {
          throw new Error('Failed to load dashboard data');
        }

        const newData = await response.json();

        // Update data intelligently to avoid flickering
        this.updateDashboardData(newData);
      } catch (error) {
        this.error = error.message || 'Failed to load dashboard';
      }

      if (showLoading) {
        this.isLoading = false;
      }
    },
    updateDashboardData(newData) {
      if (this.gamingGroups.length === 0) {
        // First load, just set the data
        this.gamingGroups = newData;
        return;
      }

      // Update existing groups and teams without recreating the array
      newData.forEach((newGroup) => {
        const existingGroupIndex = this.gamingGroups.findIndex(g => g.id === newGroup.id);

        if (existingGroupIndex !== -1) {
          // Update existing group
          const existingGroup = this.gamingGroups[existingGroupIndex];

          // Only update if data changed
          if (existingGroup.name !== newGroup.name) {
            existingGroup.name = newGroup.name;
          }
          if (existingGroup.description !== newGroup.description) {
            existingGroup.description = newGroup.description;
          }

          // Update teams
          if (newGroup.teams && newGroup.teams.length > 0) {
            newGroup.teams.forEach((newTeam) => {
              const existingTeamIndex = existingGroup.teams.findIndex(t => t.id === newTeam.id);

              if (existingTeamIndex !== -1) {
                // Update existing team - only score typically changes
                const existingTeam = existingGroup.teams[existingTeamIndex];
                if (existingTeam.score !== newTeam.score) {
                  existingTeam.score = newTeam.score;
                }
                if (existingTeam.name !== newTeam.name) {
                  existingTeam.name = newTeam.name;
                }
                if (existingTeam.description !== newTeam.description) {
                  existingTeam.description = newTeam.description;
                }
              } else {
                // New team added
                existingGroup.teams.push(newTeam);
              }
            });

            // Remove teams that no longer exist
            existingGroup.teams = existingGroup.teams.filter(existingTeam =>
              newGroup.teams.some(newTeam => newTeam.id === existingTeam.id)
            );

            // Sort teams by score (descending) to maintain ranking
            existingGroup.teams.sort((a, b) => (b.score || 0) - (a.score || 0));
          } else {
            existingGroup.teams = [];
          }
        } else {
          // New group added
          this.gamingGroups.push(newGroup);
        }
      });

      // Remove groups that no longer exist
      this.gamingGroups = this.gamingGroups.filter(existingGroup =>
        newData.some(newGroup => newGroup.id === existingGroup.id)
      );
    },
    handleError() {
      this.error = null;
    }
  }
};
</script>

<style scoped>
.dashboard-header {
  text-align: center;
  margin-bottom: 3rem;
  padding: 2rem 0;
}

.dashboard-header h1 {
  font-size: 2.5rem;
  color: #3d008d;
  margin: 0 0 0.5rem 0;
}

.subtitle {
  font-size: 1.2rem;
  color: #666;
  margin: 0;
}

.groups-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.group-card {
  height: 100%;
}

.group-header {
  border-bottom: 3px solid #3d008d;
  padding-bottom: 1rem;
  margin-bottom: 1.5rem;
}

.group-header h2 {
  font-size: 1.8rem;
  color: #3d008d;
  margin: 0 0 0.5rem 0;
}

.group-description {
  color: #666;
  margin: 0;
  font-size: 1rem;
}

.teams-leaderboard {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.leaderboard-header {
  display: grid;
  grid-template-columns: 80px 1fr 100px;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: #f0e6fd;
  border-radius: 8px;
  font-weight: bold;
  color: #3d008d;
  font-size: 0.9rem;
  text-transform: uppercase;
}

.leaderboard-row {
  display: grid;
  grid-template-columns: 80px 1fr 100px;
  gap: 1rem;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 8px;
  border: 2px solid #e0e0e0;
  transition: all 0.2s;
}

.leaderboard-row.top-three {
  background: linear-gradient(135deg, #fff 0%, #f0e6fd 100%);
  border-color: #3d008d;
}

.leaderboard-row:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.rank-col {
  display: flex;
  align-items: center;
  justify-content: center;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #666;
  color: white;
  font-weight: bold;
  font-size: 1.1rem;
}

.rank-badge.rank-1 {
  background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
  color: #333;
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.5);
}

.rank-badge.rank-2 {
  background: linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%);
  color: #333;
  box-shadow: 0 2px 8px rgba(192, 192, 192, 0.5);
}

.rank-badge.rank-3 {
  background: linear-gradient(135deg, #cd7f32 0%, #e89b6c 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(205, 127, 50, 0.5);
}

.team-col {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.team-name {
  font-weight: bold;
  font-size: 1.1rem;
  color: #333;
}

.team-desc {
  font-size: 0.85rem;
  color: #666;
  margin-top: 0.25rem;
}

.score-col {
  display: flex;
  align-items: center;
  justify-content: center;
}

.score-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #3d008d;
  transition: color 0.5s ease;
}

@keyframes score-update {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
    color: #28a745;
  }
}

.no-teams {
  text-align: center;
  padding: 2rem;
  color: #666;
  font-style: italic;
}

.empty-state {
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
  padding: 3rem;
  color: #666;
  font-size: 1.1rem;
}

@media (max-width: 768px) {
  .groups-container {
    grid-template-columns: 1fr;
  }

  .leaderboard-header,
  .leaderboard-row {
    grid-template-columns: 60px 1fr 80px;
  }

  .team-name {
    font-size: 1rem;
  }

  .team-desc {
    font-size: 0.8rem;
  }

  .score-value {
    font-size: 1.2rem;
  }
}
</style>
