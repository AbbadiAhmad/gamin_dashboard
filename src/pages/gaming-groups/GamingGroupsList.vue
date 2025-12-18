<template>
  <div>
    <base-dialog :show="!!error" title="An error occurred!" @close="handleError">
      <p>{{ error }}</p>
    </base-dialog>
    <base-dialog :show="showDeleteConfirm" title="Confirm Delete" @close="cancelDelete">
      <p>Are you sure you want to delete this gaming group?</p>
      <template #actions>
        <base-button mode="flat" @click="cancelDelete">Cancel</base-button>
        <base-button @click="confirmDelete">Delete</base-button>
      </template>
    </base-dialog>
    <section>
      <base-card>
        <div class="controls">
          <base-button mode="outline" @click="loadGroups(true)">Refresh</base-button>
          <base-button v-if="isAdmin && !isLoading" @click="showAddForm">Add Gaming Group</base-button>
        </div>
        <div v-if="isLoading">
          <base-spinner></base-spinner>
        </div>
        <ul v-else-if="hasGroups">
          <gaming-group-item
            v-for="group in gamingGroups"
            :key="group.id"
            :id="group.id"
            :name="group.name"
            :description="group.description"
            @edit="editGroup"
            @delete="showDeleteDialog"
          ></gaming-group-item>
        </ul>
        <h3 v-else>No gaming groups found.</h3>
      </base-card>
    </section>
  </div>
</template>

<script>
import GamingGroupItem from '../../components/gaming-groups/GamingGroupItem.vue';

export default {
  components: {
    GamingGroupItem,
  },
  data() {
    return {
      isLoading: false,
      error: null,
      showDeleteConfirm: false,
      groupToDelete: null,
    };
  },
  computed: {
    isAdmin() {
      return this.$store.getters['auth/isAdministrator'];
    },
    gamingGroups() {
      return this.$store.getters['gamingGroups/groups'];
    },
    hasGroups() {
      return !this.isLoading && this.$store.getters['gamingGroups/hasGroups'];
    },
  },
  created() {
    this.loadGroups();
  },
  methods: {
    async loadGroups(refresh = false) {
      this.isLoading = true;
      try {
        await this.$store.dispatch('gamingGroups/loadGroups', {
          forceRefresh: refresh,
        });
      } catch (error) {
        this.error = error.message || 'Something went wrong!';
      }
      this.isLoading = false;
    },
    handleError() {
      this.error = null;
    },
    showAddForm() {
      this.$router.push('/gaming-groups/new');
    },
    editGroup(id) {
      this.$router.push(`/gaming-groups/${id}/edit`);
    },
    showDeleteDialog(id) {
      this.groupToDelete = id;
      this.showDeleteConfirm = true;
    },
    cancelDelete() {
      this.groupToDelete = null;
      this.showDeleteConfirm = false;
    },
    async confirmDelete() {
      if (!this.groupToDelete) return;

      this.isLoading = true;
      try {
        await this.$store.dispatch('gamingGroups/deleteGroup', this.groupToDelete);
        this.showDeleteConfirm = false;
        this.groupToDelete = null;
      } catch (error) {
        this.error = error.message || 'Failed to delete gaming group!';
      }
      this.isLoading = false;
    }
  },
};
</script>

<style scoped>
ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.controls {
  display: flex;
  justify-content: space-between;
}
</style>
