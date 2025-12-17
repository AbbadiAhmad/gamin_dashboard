<template>
  <li>
    <base-card>
      <h3>{{ name }}</h3>
      <p>{{ description }}</p>
      <div>
      <base-badge :title="gamingGroup"></base-badge>
    </div>
      <div class="actions" v-if="isAdmin">
        <base-button mode="outline" @click="editGame">Edit</base-button>
        <base-button mode="flat" @click="deleteGame">Delete</base-button>
      </div>
    </base-card>
  </li>
</template>

<script>
export default {
  props: ['id', 'name', 'description', 'gamingGroup'],
  computed: {
    isAdmin() {
      return this.$store.getters['auth/isAdministrator'];
    }
  },
  methods: {
    editGame() {
      this.$emit('edit', this.id);
    },
    deleteGame() {
      this.$emit('delete', this.id);
    }
  }
};
</script>

<style scoped>
li {
  margin: 1rem 0;
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
}
</style>
