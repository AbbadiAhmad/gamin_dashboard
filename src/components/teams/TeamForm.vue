<template>
  <form @submit.prevent="submitForm">
    <div class="form-control" :class="{invalid: !name.isValid}">
      <label for="name">Team Name</label>
      <input type="text" id="name" v-model.trim="name.val" @blur="clearValidity('name')" />
      <p v-if="!name.isValid">Name must not be empty.</p>
    </div>
    <div class="form-control" :class="{invalid: !description.isValid}">
      <label for="description">Description</label>
      <textarea id="description" rows="5" v-model.trim="description.val" @blur="clearValidity('description')"></textarea>
      <p v-if="!description.isValid">Description must not be empty.</p>
    </div>
    <div class="actions">
      <base-button>{{ isEdit ? 'Update' : 'Create' }} Team</base-button>
      <base-button type="button" mode="flat" @click="goBack">Cancel</base-button>
    </div>
  </form>
</template>

<script>
export default {
  props: {
    isEdit: {
      type: Boolean,
      default: false
    },
    teamData: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      name: {
        val: '',
        isValid: true
      },
      description: {
        val: '',
        isValid: true
      },
      formIsValid: true
    };
  },
  watch: {
    teamData: {
      handler(newData) {
        if (newData) {
          this.name.val = newData.name || '';
          this.description.val = newData.description || '';
        }
      },
      immediate: true
    }
  },
  methods: {
    clearValidity(input) {
      this[input].isValid = true;
    },
    validateForm() {
      this.formIsValid = true;
      if (this.name.val === '') {
        this.name.isValid = false;
        this.formIsValid = false;
      }
      if (this.description.val === '') {
        this.description.isValid = false;
        this.formIsValid = false;
      }
    },
    submitForm() {
      this.validateForm();

      if (!this.formIsValid) {
        return;
      }

      const formData = {
        name: this.name.val,
        description: this.description.val
      };

      this.$emit('save-data', formData);
    },
    goBack() {
      this.$router.push('/teams');
    }
  }
};
</script>

<style scoped>
.form-control {
  margin: 1rem 0;
}

label {
  font-weight: bold;
  display: block;
  margin-bottom: 0.5rem;
}

input[type='text'],
textarea {
  display: block;
  width: 100%;
  border: 1px solid #ccc;
  font: inherit;
  padding: 0.5rem;
}

input[type='text']:focus,
textarea:focus {
  background-color: #f0e6fd;
  outline: none;
  border-color: #3d008d;
}

.form-control.invalid input,
.form-control.invalid textarea {
  border-color: red;
}

.form-control.invalid p {
  color: red;
  margin: 0.5rem 0 0 0;
}

.actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}
</style>
