<template>
  <li>
    <h3>{{ name }}</h3>
    <p class="description">{{ description }}</p>
    <div class="info">
      <span>Points: {{ minimumPoint }} - {{ maximumPoint }}</span>
      <span class="status" :class="statusClass">{{ statusLabel }}</span>
    </div>
    <div>
      <base-badge :type="gamingGroupName" :title="gamingGroupName"></base-badge>
    </div>
    <div class="actions">
      <base-button link :to="viewLink">Evaluate</base-button>
      <base-button v-if="adminModeEnabled" mode="outline" link :to="editLink">Edit</base-button>
      <base-button v-if="adminModeEnabled" mode="flat" @click="deleteGame">Delete</base-button>
    </div>
  </li>
</template>

<script>
export default {
  props: {
    id: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    description: String,
    minimumPoint: Number,
    maximumPoint: Number,
    gamingGroupName: String,
    status: {
      type: String,
      default: 'coming'
    }
  },
  computed: {
    isAdmin() {
      return this.$store.getters['auth/userRole'] === 'administrator';
    },
    adminModeEnabled() {
      return this.$store.getters.adminModeEnabled;
    },
    editLink() {
      return '/games/' + this.id + '/edit';
    },
    viewLink() {
      return '/games/' + this.id;
    },
    statusLabel() {
      const labels = {
        coming: 'Coming',
        running: 'Running',
        past: 'Past'
      };
      return labels[this.status] || this.status;
    },
    statusClass() {
      return 'status-' + this.status;
    }
  },
  methods: {
    deleteGame() {
      this.$emit('delete', this.id);
    }
  }
};
</script>

<style scoped>
li {
  margin: 1rem 0;
  border: 1px solid #424242;
  border-radius: 12px;
  padding: 1rem;
}

h3 {
  font-size: 1.5rem;
  margin: 0.5rem 0;
}

.description {
  color: #666;
  margin: 0.5rem 0;
}

.info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0.5rem 0;
  font-size: 0.9rem;
}

.status {
  padding: 0.25rem 0.75rem;
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

div {
  margin: 0.5rem 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  li {
    padding: 0.875rem;
  }

  h3 {
    font-size: 1.25rem;
  }

  .info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .actions {
    gap: 0.25rem;
  }
}

@media (max-width: 480px) {
  li {
    padding: 0.75rem;
  }

  h3 {
    font-size: 1.1rem;
  }

  .description {
    font-size: 0.9rem;
  }

  .info {
    font-size: 0.85rem;
  }

  .actions {
    flex-direction: column;
    width: 100%;
  }

  .actions button,
  .actions a {
    width: 100%;
    margin: 0.25rem 0;
  }
}
</style>
