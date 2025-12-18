<template>
  <section>
    <base-card>
      <h2>Welcome! Setup Your Administrator Account</h2>
      <p>This is the first time you're running this application. Please create an administrator account to get started.</p>
      <form @submit.prevent="submitForm">
        <div class="form-control" :class="{invalid: !name.isValid}">
          <label for="name">Administrator Name</label>
          <input
            type="text"
            id="name"
            v-model.trim="name.val"
            @blur="clearValidity('name')"
          />
          <p v-if="!name.isValid">Please enter your name.</p>
        </div>
        <div class="form-control" :class="{invalid: !email.isValid}">
          <label for="email">Email</label>
          <input
            type="email"
            id="email"
            v-model.trim="email.val"
            @blur="clearValidity('email')"
          />
          <p v-if="!email.isValid">Please enter a valid email.</p>
        </div>
        <div class="form-control" :class="{invalid: !password.isValid}">
          <label for="password">Password</label>
          <input
            type="password"
            id="password"
            v-model.trim="password.val"
            @blur="clearValidity('password')"
          />
          <p v-if="!password.isValid">Password must be at least 6 characters long.</p>
        </div>
        <p v-if="!formIsValid" class="error-message">Please fix the above errors and submit again.</p>
        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
        <base-button :disabled="isLoading">{{ isLoading ? 'Setting up...' : 'Complete Setup' }}</base-button>
      </form>
    </base-card>
  </section>
</template>

<script>
export default {
  data() {
    return {
      name: {
        val: '',
        isValid: true,
      },
      email: {
        val: '',
        isValid: true,
      },
      password: {
        val: '',
        isValid: true,
      },
      formIsValid: true,
      isLoading: false,
      errorMessage: null,
    };
  },
  methods: {
    clearValidity(input) {
      this[input].isValid = true;
      this.errorMessage = null;
    },
    validateForm() {
      this.formIsValid = true;

      if (this.name.val === '') {
        this.name.isValid = false;
        this.formIsValid = false;
      }

      if (this.email.val === '' || !this.email.val.includes('@')) {
        this.email.isValid = false;
        this.formIsValid = false;
      }

      if (this.password.val.length < 6) {
        this.password.isValid = false;
        this.formIsValid = false;
      }
    },
    async submitForm() {
      this.validateForm();

      if (!this.formIsValid) {
        return;
      }

      this.isLoading = true;
      this.errorMessage = null;

      try {
        const response = await fetch('http://localhost:3000/setup/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: this.name.val,
            email: this.email.val,
            password: this.password.val
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to complete setup');
        }

        // Store the token and user info
        const expiresIn = 2 * 60 * 60 * 1000; // 2 hours
        const expirationDate = new Date().getTime() + expiresIn;

        this.$store.commit('auth/setUser', {
          token: data.token,
          userId: data.user.id,
          userName: data.user.name,
          userEmail: data.user.email,
          userRole: data.user.role,
          tokenExpiration: expirationDate
        });

        // Set auto-logout
        this.$store.dispatch('auth/setAutoLogout', expiresIn);

        // Redirect to home page
        this.$router.replace('/');
      } catch (error) {
        this.errorMessage = error.message;
      } finally {
        this.isLoading = false;
      }
    }
  },
};
</script>

<style scoped>
.form-control {
  margin: 0.5rem 0;
}

label {
  font-weight: bold;
  display: block;
  margin-bottom: 0.5rem;
}

input {
  display: block;
  width: 100%;
  border: 1px solid #ccc;
  font: inherit;
  padding: 0.5rem;
}

input:focus {
  background-color: #f0e6fd;
  outline: none;
  border-color: #3d008d;
}

.invalid label {
  color: red;
}

.invalid input {
  border: 1px solid red;
}

.error-message {
  color: red;
  font-weight: bold;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
