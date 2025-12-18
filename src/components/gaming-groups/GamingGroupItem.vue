<template>
  <li>
    <base-card>
      <div class="group-container">
        <div class="group-info">
          <h3>{{ name }}</h3>
          <p>{{ description }}</p>
          <div class="actions">
            <base-button link :to="viewDetailsLink">View Details</base-button>
            <base-button v-if="isAdmin" mode="outline" @click="editGroup">Edit</base-button>
            <base-button v-if="isAdmin" mode="flat" @click="deleteGroup">Delete</base-button>
          </div>
        </div>
      </div>
    </base-card>
  </li>
</template>

<script>
export default {
  props: ['id', 'name', 'description'],
  computed: {
    isAdmin() {
      return this.$store.getters['auth/isAdministrator'];
    },
    viewDetailsLink() {
      return `/gaming-groups/${this.id}`;
    }
  },
  methods: {
    editGroup() {
      this.$emit('edit', this.id);
    },
    deleteGroup() {
      this.$emit('delete', this.id);
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
  color: #666;
}

.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}
</style>
