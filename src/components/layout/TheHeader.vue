<template>
  <div>
    <header :class="{ 'header-hidden': !isHeaderVisible }">
      <nav v-show="isHeaderVisible">
        <h1>
          <router-link to="/">Gaming Dashboard</router-link>
        </h1>
        <ul>
          <li class="dropdown">
            <button @click="toggleDropdown" class="dropdown-btn">
              Dashboard
              <span class="arrow">{{ showDropdown ? '▲' : '▼' }}</span>
            </button>
            <ul v-if="showDropdown" class="dropdown-menu">
              <li>
                <router-link to="/dashboard" @click="closeDropdown">Game Dashboard</router-link>
              </li>
              <li>
                <router-link to="/dashboard/gaming-groups" @click="closeDropdown">Gaming Groups Dashboard</router-link>
              </li>
            </ul>
          </li>
<!--         <li>
          <router-link to="/coaches">All Coaches</router-link>
        </li>
        <li>
          <router-link to="/requests">Requests</router-link>
        </li> -->
          <li v-if="isLoggedIn">
            <router-link to="/gaming-groups">Gaming Groups</router-link>
          </li>
          <li v-if="isLoggedIn">
            <router-link to="/teams">Teams</router-link>
          </li>
          <li v-if="isAdmin" class="dropdown">
            <button @click="toggleDatabaseDropdown" class="dropdown-btn">
              Database
              <span class="arrow">{{ showDatabaseDropdown ? '▲' : '▼' }}</span>
            </button>
            <ul v-if="showDatabaseDropdown" class="dropdown-menu">
              <li>
                <button @click="exportDatabase" class="dropdown-menu-btn">Export Backup</button>
              </li>
              <li>
                <button @click="triggerImport" class="dropdown-menu-btn">Import Backup</button>
              </li>
            </ul>
          </li>
          <li v-if="!isLoggedIn">
            <router-link to="/auth">Login</router-link>
          </li>
          <li v-if="isLoggedIn">
            <span class="user-name">{{ userName }}</span>
          </li>
          <li v-if="isLoggedIn">
            <button @click="logout" class="logout-btn">Logout</button>
          </li>
        </ul>
      </nav>
      <button @click="toggleHeader" class="toggle-header-btn" :title="isHeaderVisible ? 'Hide Header' : 'Show Header'">
        <span v-if="isHeaderVisible">▲</span>
        <span v-else>▼</span>
      </button>
    </header>
    <input
      ref="fileInput"
      type="file"
      accept=".zip"
      @change="handleFileUpload"
      style="display: none"
    />
    <transition name="fade">
      <div v-if="notification.show" :class="['notification', notification.type]">
        {{ notification.message }}
      </div>
    </transition>
  </div>
</template>

<script>
import { API_BASE_URL } from '../../config.js';

export default {
  data() {
    return {
      isHeaderVisible: true,
      showDropdown: false,
      showDatabaseDropdown: false,
      notification: {
        show: false,
        message: '',
        type: 'success' // 'success' or 'error'
      }
    };
  },
  computed: {
    isLoggedIn() {
      return this.$store.getters['auth/isAuthenticated'];
    },
    isAdmin() {
      return this.$store.getters['auth/isAdministrator'];
    },
    userName() {
      return this.$store.getters['auth/userName'];
    }
  },
  methods: {
    showNotification(message, type = 'success') {
      this.notification.message = message;
      this.notification.type = type;
      this.notification.show = true;

      setTimeout(() => {
        this.notification.show = false;
      }, 3000);
    },
    logout() {
      this.$store.dispatch('auth/logout');
      this.$router.replace('/auth');
    },
    toggleHeader() {
      this.isHeaderVisible = !this.isHeaderVisible;
    },
    toggleDropdown() {
      this.showDropdown = !this.showDropdown;
    },
    closeDropdown() {
      this.showDropdown = false;
    },
    toggleDatabaseDropdown() {
      this.showDatabaseDropdown = !this.showDatabaseDropdown;
    },
    closeDatabaseDropdown() {
      this.showDatabaseDropdown = false;
    },
    async exportDatabase() {
      this.closeDatabaseDropdown();

      try {
        const token = this.$store.getters['auth/token'];

        const response = await fetch(`${API_BASE_URL}/api/database/export`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to export database');
        }

        // Download the file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'gaming_dashboard_backup.zip';
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        this.showNotification('Database exported successfully!');
      } catch (error) {
        console.error('Export error:', error);
        this.showNotification('Failed to export database: ' + error.message, 'error');
      }
    },
    triggerImport() {
      this.closeDatabaseDropdown();
      this.$refs.fileInput.click();
    },
    async handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      if (!file.name.endsWith('.zip')) {
        this.showNotification('Please select a .zip file', 'error');
        this.$refs.fileInput.value = '';
        return;
      }

      if (!confirm('WARNING: Importing a database backup will replace ALL current data. This action cannot be undone. Are you sure you want to continue?')) {
        this.$refs.fileInput.value = '';
        return;
      }

      try {
        const token = this.$store.getters['auth/token'];
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/api/database/import`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to import database');
        }

        this.showNotification('Database imported successfully! Reloading page...');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (error) {
        console.error('Import error:', error);
        this.showNotification('Failed to import database: ' + error.message, 'error');
      } finally {
        this.$refs.fileInput.value = '';
      }
    }
  }
};
</script>

<style scoped>
header {
  width: 100%;
  background-color: #3d008d;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  transition: height 0.3s ease;
  height: 5rem;
}

header.header-hidden {
  height: 2.5rem;
}

header a {
  text-decoration: none;
  color: #f391e3;
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border: 1px solid transparent;
}

a:active,
a:hover,
a.router-link-active {
  border: 1px solid #f391e3;
}

h1 {
  margin: 0;
}

h1 a {
  color: white;
  margin: 0;
}

h1 a:hover,
h1 a:active,
h1 a.router-link-active {
  border-color: transparent;
}

header nav {
  width: 90%;
  margin: auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

header ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

li {
  margin: 0 0.5rem;
  position: relative;
}

.dropdown {
  position: relative;
}

.dropdown-btn {
  background-color: transparent;
  border: 1px solid transparent;
  color: #f391e3;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font: inherit;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.dropdown-btn:hover {
  border: 1px solid #f391e3;
}

.arrow {
  font-size: 0.7rem;
  transition: transform 0.3s;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background-color: #3d008d;
  border: 2px solid #f391e3;
  border-radius: 4px;
  list-style: none;
  margin: 0.5rem 0 0 0;
  padding: 0;
  min-width: 200px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.dropdown-menu li {
  margin: 0;
}

.dropdown-menu a {
  display: block;
  padding: 0.75rem 1.5rem;
  border: none;
  white-space: nowrap;
}

.dropdown-menu a:hover {
  background-color: #f391e3;
  color: #3d008d;
}

.dropdown-menu-btn {
  width: 100%;
  text-align: left;
  background-color: transparent;
  border: none;
  color: #f391e3;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font: inherit;
  white-space: nowrap;
}

.dropdown-menu-btn:hover {
  background-color: #f391e3;
  color: #3d008d;
}

.user-name {
  color: white;
  font-weight: bold;
  padding: 0.75rem 1.5rem;
}

.logout-btn {
  background-color: transparent;
  border: 1px solid #f391e3;
  color: #f391e3;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font: inherit;
  border-radius: 4px;
}

.logout-btn:hover {
  background-color: #f391e3;
  color: #3d008d;
}

.toggle-header-btn {
  position: absolute;
  bottom: -2px;
  left: 3%;
  transform: translateX(-50%);
  background-color: #3d008d;
  color: white;
  border: 2px solid #f391e3;
  border-radius: 0 0 8px 8px;
  padding: 0.25rem 1rem;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;
  z-index: 1000;
}

.toggle-header-btn:hover {
  background-color: #f391e3;
  color: #3d008d;
}

.header-hidden .toggle-header-btn {
  bottom: 0.5rem;
}

.notification {
  position: fixed;
  top: 6rem;
  right: 2rem;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  min-width: 250px;
  max-width: 400px;
}

.notification.success {
  background-color: #4caf50;
  color: white;
  border: 2px solid #45a049;
}

.notification.error {
  background-color: #f44336;
  color: white;
  border: 2px solid #da190b;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>