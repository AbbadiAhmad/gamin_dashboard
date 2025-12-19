<template>
  <li>
    <h3>{{ name }}</h3>
    <p class="description">{{ description }}</p>
    <div v-if="adminModeEnabled" class="actions">
      <base-button mode="outline" link :to="editLink">Edit</base-button>
      <base-button mode="flat" @click="deleteTeam">Delete</base-button>
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
    description: String
  },
  computed: {
    adminModeEnabled() {
      return this.$store.getters.adminModeEnabled;
    },
    editLink() {
      return '/teams/' + this.id + '/edit';
    }
  },
  methods: {
    deleteTeam() {
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

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

@media (max-width: 768px) {
  li {
    padding: 0.875rem;
  }

  h3 {
    font-size: 1.25rem;
  }

  .actions {
    flex-wrap: wrap;
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
