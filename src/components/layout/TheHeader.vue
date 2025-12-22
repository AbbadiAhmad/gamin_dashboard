<template>
  <div>
    <header>
      <nav>
        <!-- <h1>
          <router-link to="/" @click="closeMobileMenu">Gaming Dashboard</router-link>
        </h1> -->
        <button class="hamburger" @click="toggleMobileMenu" :class="{ 'active': isMobileMenuOpen }">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <ul :class="{ 'mobile-menu-open': isMobileMenuOpen }">
          <li class="dropdown">
            <button @click="toggleDropdown" class="dropdown-btn">
              Dashboard
              <span class="arrow">{{ showDropdown ? '▲' : '▼' }}</span>
            </button>
            <ul v-if="showDropdown" class="dropdown-menu">
              <li>
                <router-link to="/dashboard" @click="closeDropdown(); closeMobileMenu()">Game Dashboard</router-link>
              </li>
              <li>
                <router-link to="/dashboard/gaming-groups" @click="closeDropdown(); closeMobileMenu()">Gaming Groups
                  Dashboard</router-link>
              </li>
              <li>
                <router-link to="/dashboard/audience" @click="closeDropdown(); closeMobileMenu()">Time Game</router-link>
              </li>

            </ul>
          </li>
          <li>
            <router-link to="/teamboard" @click="closeMobileMenu">Team Board</router-link>
          </li>
          <li v-if="isLoggedIn">
            <router-link to="/gaming-groups" @click="closeMobileMenu">Gaming Groups</router-link>
          </li>
          <li v-if="isAdmin" class="admin-mode-menu-item">
            <label class="switch">
              <input type="checkbox" :checked="adminModeEnabled" @change="toggleAdminMode" />
              <span class="slider"></span>
            </label>
            <span class="admin-mode-label">Admin Mode</span>
          </li>
          <li v-if="isLoggedIn && adminModeEnabled">
            <router-link to="/teams" @click="closeMobileMenu">Teams</router-link>
          </li>
          <li v-if="isAdmin && adminModeEnabled" class="dropdown">
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
            <router-link to="/auth" @click="closeMobileMenu">Login</router-link>
          </li>
          <li v-if="isLoggedIn">
            <button @click="logout" class="logout-btn">{{ userName }} Logout</button>
          </li>
        </ul>
      </nav>
      <!-- <button @click="toggleHeader" class="toggle-header-btn" :title="isHeaderVisible ? 'Hide Header' : 'Show Header'">
        <span v-if="isHeaderVisible">▲</span>
        <span v-else>▼</span>
      </button> -->
    </header>
    <input ref="fileInput" type="file" accept=".zip" @change="handleFileUpload" style="display: none" />
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
      isMobileMenuOpen: false,
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
    },
    adminModeEnabled() {
      return this.$store.getters.adminModeEnabled;
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
      this.isMobileMenuOpen = false;
    },
    toggleHeader() {
      this.isHeaderVisible = !this.isHeaderVisible;
    },
    toggleMobileMenu() {
      this.isMobileMenuOpen = !this.isMobileMenuOpen;
      if (this.isMobileMenuOpen) {
        this.showDropdown = true;
        this.showDatabaseDropdown = false;
      }
    },
    closeMobileMenu() {
      this.isMobileMenuOpen = false;
      this.showDropdown = true;
      this.showDatabaseDropdown = false;
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
    toggleAdminMode() {
      this.$store.dispatch('toggleAdminMode');
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
  height: 3.5rem;
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

/* h1 {
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
} */

header nav {
  width: 100%;
  margin: auto;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 0 1rem;
}

header ul {
  position: fixed;
  left: -100%;
  top: 3.5rem;
  flex-direction: column;
  background-color: #3d008d;
  width: 300px;
  max-width: 100%;
  text-align: center;
  transition: left 0.3s ease-in-out;
  box-shadow: 0 10px 27px rgba(0, 0, 0, 0.5);
  z-index: 999;
  max-height: calc(100vh - 3.5rem);
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0;
}

header ul.mobile-menu-open {
  left: 0;
}

header ul li {
  margin: 0;
  width: 100%;
}

header ul li a,
.dropdown-btn {
  width: 100%;
  text-align: center;
  padding: 1rem;
  border-bottom: 1px solid rgba(243, 145, 227, 0.2);
}

li {
  position: relative;
}

.dropdown {
  width: 100%;
}

.dropdown-btn {
  background-color: transparent;
  border: none;
  color: #f391e3;
  cursor: pointer;
  font: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.dropdown-btn:hover {
  background-color: #f391e3;
  color: #3d008d;
}

.arrow {
  font-size: 0.7rem;
  transition: transform 0.3s;
}

.dropdown-menu {
  position: static;
  width: 100%;
  border: none;
  border-radius: 0;
  box-shadow: none;
  background-color: #2d006d;
  list-style: none;
  margin: 0;
  padding: 0;
}

.dropdown-menu li {
  margin: 0;
}

.dropdown-menu a {
  display: block;
  padding: 0.75rem 1rem;
  border: none;
  border-bottom: 1px solid rgba(243, 145, 227, 0.1);
  white-space: nowrap;
}

.dropdown-menu a:hover {
  background-color: #f391e3;
  color: #3d008d;
}

.dropdown-menu-btn {
  width: 100%;
  text-align: center;
  background-color: transparent;
  border: none;
  color: #f391e3;
  padding: 0.75rem 1rem;
  cursor: pointer;
  font: inherit;
  white-space: nowrap;
  border-bottom: 1px solid rgba(243, 145, 227, 0.1);
}

.dropdown-menu-btn:hover {
  background-color: #f391e3;
  color: #3d008d;
}

.logout-btn {
  width: 90%;
  margin: 1rem auto;
  display: block;
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

.admin-mode-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  border-bottom: 1px solid rgba(243, 145, 227, 0.2);
}

.admin-mode-label {
  color: white;
  font-weight: 600;
  font-size: 0.95rem;
  user-select: none;
}

/* Toggle Switch Styles */
.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 28px;
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
  border-radius: 28px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked+.slider {
  background-color: #f391e3;
}

input:checked+.slider:before {
  transform: translateX(22px);
}

.slider:hover {
  background-color: #999;
}

input:checked+.slider:hover {
  background-color: #db6dd1;
}

/* .toggle-header-btn {
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
} */

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

.fade-enter-active,
.fade-leave-active {
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

/* Hamburger menu button */
.hamburger {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  width: 2rem;
  height: 2rem;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  z-index: 10;
}

.hamburger span {
  width: 2rem;
  height: 0.25rem;
  background: #f391e3;
  border-radius: 10px;
  transition: all 0.3s linear;
  position: relative;
  transform-origin: 1px;
}

.hamburger.active span:nth-child(1) {
  transform: rotate(45deg);
}

.hamburger.active span:nth-child(2) {
  opacity: 0;
  transform: translateX(20px);
}

.hamburger.active span:nth-child(3) {
  transform: rotate(-45deg);
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  header {
    height: auto;
    min-height: 3.5rem;
  }

  header.header-hidden {
    height: 2.5rem;
  }

  header nav {
    width: 95%;
    flex-wrap: wrap;
    position: relative;
  }

  h1 {
    font-size: 1.2rem;
  }

  h1 a {
    padding: 0.5rem 0.75rem;
  }

  .hamburger {
    display: flex;
  }

  header ul {
    position: fixed;
    left: -100%;
    top: 3.5rem;
    flex-direction: column;
    background-color: #3d008d;
    width: 100%;
    text-align: center;
    transition: left 0.3s ease-in-out;
    box-shadow: 0 10px 27px rgba(0, 0, 0, 0.5);
    z-index: 999;
    max-height: calc(100vh - 3.5rem);
    overflow-y: auto;
  }

  header ul.mobile-menu-open {
    left: 0;
  }

  header ul li {
    margin: 0;
    width: 100%;
  }

  header ul li a,
  .dropdown-btn,
  .user-name {
    width: 100%;
    text-align: center;
    padding: 1rem;
    border-bottom: 1px solid rgba(243, 145, 227, 0.2);
  }

  .dropdown {
    width: 100%;
  }

  .dropdown-btn {
    width: 100%;
    justify-content: center;
  }

  .dropdown-menu {
    position: static;
    width: 100%;
    border: none;
    border-radius: 0;
    box-shadow: none;
    background-color: #2d006d;
  }

  .dropdown-menu li a,
  .dropdown-menu-btn {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(243, 145, 227, 0.1);
  }

  .logout-btn {
    width: 90%;
    margin: 1rem auto;
    display: block;
  }

  .admin-mode-menu-item {
    width: 100%;
    justify-content: center;
    padding: 1rem;
    border-bottom: 1px solid rgba(243, 145, 227, 0.2);
  }

  .notification {
    top: 4rem;
    right: 0.5rem;
    left: 0.5rem;
    width: auto;
    max-width: none;
    min-width: auto;
  }

  .toggle-header-btn {
    left: 50%;
    font-size: 0.9rem;
    padding: 0.2rem 0.75rem;
  }
}

@media (max-width: 480px) {
  h1 {
    font-size: 1rem;
  }

  h1 a {
    padding: 0.4rem 0.5rem;
  }

  .notification {
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
  }
}
</style>