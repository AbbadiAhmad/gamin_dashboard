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
  </div>
</template>

<script>
export default {
  data() {
    return {
      isHeaderVisible: true,
      showDropdown: false
    };
  },
  computed: {
    isLoggedIn() {
      return this.$store.getters['auth/isAuthenticated'];
    },
    userName() {
      return this.$store.getters['auth/userName'];
    }
  },
  methods: {
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
  left: 50%;
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
</style>