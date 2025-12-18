<template>
  <li>
    <base-card>
      <div class="group-container">
        <div class="group-info">
          <h3>{{ name }}</h3>
          <p>{{ description }}</p>
          <div class="actions">
            <base-button link :to="viewGamesLink">View Games</base-button>
            <base-button v-if="isAdmin" link :to="addGameLink" mode="outline">Add Game</base-button>
            <base-button v-if="isAdmin" mode="outline" @click="editGroup">Edit Group</base-button>
            <base-button v-if="isAdmin" mode="flat" @click="deleteGroup">Delete</base-button>
          </div>
        </div>
        <div class="games-list" v-if="games.length > 0">
          <h4>Games</h4>
          <ul @drop="onDrop" @dragover.prevent>
            <li
              v-for="(game, index) in sortedGames"
              :key="game.id"
              :draggable="isAdmin"
              @dragstart="onDragStart(index, $event)"
              @dragend="onDragEnd"
              class="game-item"
              :class="{ dragging: dragIndex === index }"
            >
              <span class="game-name">{{ game.name }}</span>
              <span class="game-status" :class="`status-${game.status}`">{{ getStatusLabel(game.status) }}</span>
            </li>
          </ul>
        </div>
      </div>
    </base-card>
  </li>
</template>

<script>
export default {
  props: ['id', 'name', 'description'],
  data() {
    return {
      dragIndex: null,
      localGames: []
    };
  },
  computed: {
    isAdmin() {
      return this.$store.getters['auth/isAdministrator'];
    },
    viewGamesLink() {
      return `/games?groupId=${this.id}`;
    },
    addGameLink() {
      return `/games/new?groupId=${this.id}`;
    },
    games() {
      return this.$store.getters['games/getGamesByGroupId'](this.id);
    },
    sortedGames() {
      return this.localGames.length > 0 ? this.localGames : [...this.games].sort((a, b) => a.displayOrder - b.displayOrder);
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
  methods: {
    editGroup() {
      this.$emit('edit', this.id);
    },
    deleteGroup() {
      this.$emit('delete', this.id);
    },
    getStatusLabel(status) {
      const labels = {
        coming: 'Coming',
        running: 'Running',
        past: 'Past'
      };
      return labels[status] || status;
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
        // Reorder locally
        const draggedGame = this.localGames[this.dragIndex];
        this.localGames.splice(this.dragIndex, 1);
        this.localGames.splice(dropIndex, 0, draggedGame);

        // Update display orders and save to backend
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
    }
  }
};
</script>

<style scoped>
li {
  margin: 1rem 0;
}

.group-container {
  display: flex;
  gap: 2rem;
}

.group-info {
  flex: 1;
}

h3 {
  font-size: 1.5rem;
  margin: 0.5rem 0;
}

p {
  margin: 0.5rem 0;
}

.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.games-list {
  flex: 0 0 300px;
  border-left: 2px solid #e0e0e0;
  padding-left: 1.5rem;
}

.games-list h4 {
  margin-top: 0;
  margin-bottom: 0.75rem;
  font-size: 1.1rem;
  color: #3d008d;
}

.games-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.game-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  background: #f9f9f9;
  border-radius: 4px;
  transition: all 0.2s;
}

.game-item:hover {
  background: #f0f0f0;
  cursor: move;
}

.game-item.dragging {
  opacity: 0.5;
}

.game-name {
  font-weight: 500;
  flex: 1;
}

.game-status {
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: bold;
  text-transform: uppercase;
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
</style>
