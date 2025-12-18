<template>
  <section>
    <base-card>
      <h2>Login</h2>
      <form @submit.prevent="submitForm">
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
        <base-button :disabled="isLoading">{{ isLoading ? 'Logging in...' : 'Login' }}</base-button>
      </form>
    </base-card>
  </section>
</template>

<script>
export default {
  data() {
    return {
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
        await this.$store.dispatch('auth/login', {
          email: this.email.val,
          password: this.password.val
        });

        // Redirect after successful authentication
        this.$router.replace('/');
      } catch (error) {
        // Provide user-friendly error messages
        const errorMsg = error.message || '';

        if (errorMsg.includes('Invalid email or password')) {
          this.errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (errorMsg.includes('required')) {
          this.errorMessage = 'Email and password are required.';
        } else if (errorMsg.includes('Failed to fetch')) {
          this.errorMessage = 'Unable to connect to server. Please check your connection and try again.';
        } else {
          this.errorMessage = errorMsg || 'Authentication failed. Please try again.';
        }
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

input,
textarea {
  display: block;
  width: 100%;
  border: 1px solid #ccc;
  font: inherit;
}

input:focus,
textarea:focus {
  background-color: #f0e6fd;
  outline: none;
  border-color: #3d008d;
}

h3 {
  margin: 0.5rem 0;
  font-size: 1rem;
}

.invalid label {
  color: red;
}

.invalid input,
.invalid textarea {
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
