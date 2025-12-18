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
        <div v-if="isAdmin" class="dashboard-toggle">
          <label class="switch">
            <input
              type="checkbox"
              :checked="showInDashboard"
              @change="toggleDashboard"
            />
            <span class="slider"></span>
          </label>
          <span class="toggle-label">Show in Dashboard</span>
        </div>
      </div>
    </base-card>
  </li>
</template>

<script>
export default {
  props: ['id', 'name', 'description', 'showInDashboard'],
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
    },
    async toggleDashboard(event) {
      const newValue = event.target.checked;
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:3000/gaming-groups/${this.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: this.name,
            description: this.description,
            showInDashboard: newValue
          })
        });

        if (!response.ok) {
          throw new Error('Failed to update dashboard visibility');
        }

        this.$emit('toggle-dashboard', this.id, newValue);
      } catch (error) {
        console.error('Error toggling dashboard:', error);
        // Revert checkbox on error
        event.target.checked = !newValue;
      }
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

.dashboard-toggle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 8px;
  border: 2px solid #e0e0e0;
  min-width: 150px;
}

.toggle-label {
  font-size: 0.85rem;
  color: #666;
  font-weight: 500;
  text-align: center;
}

/* Toggle Switch Styles */
.switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 34px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: 34px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #3d008d;
}

input:checked + .slider:before {
  transform: translateX(26px);
}

.slider:hover {
  background-color: #999;
}

input:checked + .slider:hover {
  background-color: #2d006d;
}
</style>
