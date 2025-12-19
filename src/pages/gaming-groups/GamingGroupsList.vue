<template>
  <div>
    <base-dialog :show="!!error" title="An error occurred!" @close="handleError">
      <p>{{ error }}</p>
    </base-dialog>
    <section>
      <base-card>
        <the-breadcrumb :crumbs="[{ label: 'Gaming Groups' }]"></the-breadcrumb>
        <div class="controls">
          <base-button mode="outline" @click="loadGroups(true)">Refresh</base-button>
          <base-button v-if="adminModeEnabled && !isLoading" @click="showAddForm">Add Gaming Group</base-button>
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
            :show-in-dashboard="group.showInDashboard"
            @toggle-dashboard="handleToggleDashboard"
          ></gaming-group-item>
        </ul>
        <h3 v-else>No gaming groups found.</h3>
      </base-card>
    </section>
  </div>
</template>

<script>
import GamingGroupItem from '../../components/gaming-groups/GamingGroupItem.vue';
import TheBreadcrumb from '../../components/ui/TheBreadcrumb.vue';

export default {
  components: {
    GamingGroupItem,
    TheBreadcrumb
  },
  data() {
    return {
      isLoading: false,
      error: null,
    };
  },
  computed: {
    isAdmin() {
      return this.$store.getters['auth/isAdministrator'];
    },
    adminModeEnabled() {
      return this.$store.getters.adminModeEnabled;
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
    handleToggleDashboard() {
      // Refresh the list to show updated toggle state
      this.loadGroups(true);
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
