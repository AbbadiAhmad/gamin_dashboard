<template>
  <header>
    <nav>
      <h1>
        <router-link to="/">Find a Coach</router-link>
      </h1>
      <ul>
        <li>
          <router-link to="/coaches">All Coaches</router-link>
        </li>
        <li>
          <router-link to="/requests">Requests</router-link>
        </li>
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
  </header>
</template>

<script>
export default {
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
    }
  }
};
</script>

<style scoped>
header {
  width: 100%;
  height: 5rem;
  background-color: #3d008d;
  display: flex;
  justify-content: center;
  align-items: center;
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
</style>