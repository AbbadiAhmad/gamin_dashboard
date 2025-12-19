<template>
  <teleport to="body">
    <div v-if="show" @click="tryClose" class="backdrop"></div>
    <transition name="dialog">
      <dialog open v-if="show">
        <header>
          <slot name="header">
            <h2>{{ title }}</h2>
          </slot>
        </header>
        <section>
          <slot></slot>
        </section>
        <menu v-if="!fixed">
          <slot name="actions">
            <base-button @click="tryClose">Close</base-button>
          </slot>
        </menu>
      </dialog>
    </transition>
  </teleport>
</template>

<script>
export default {
  props: {
    show: {
      type: Boolean,
      required: true,
    },
    title: {
      type: String,
      required: false,
    },
    fixed: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ['close'],
  methods: {
    tryClose() {
      if (this.fixed) {
        return;
      }
      this.$emit('close');
    },
  },
};
</script>

<style scoped>
.backdrop {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 100%;
  background-color: rgba(0, 0, 0, 0.75);
  z-index: 10;
}

dialog {
  position: fixed;
  top: 5vh;
  left: 5%;
  width: 90%;
  max-height: 90vh;
  z-index: 100;
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.26);
  padding: 0;
  margin: 0;
  overflow-y: auto;
  background-color: white;
}

header {
  background-color: #3a0061;
  color: white;
  width: 100%;
  padding: 1rem;
}

header h2 {
  margin: 0;
  font-size: 1.25rem;
}

section {
  padding: 1rem;
  max-height: calc(90vh - 8rem);
  overflow-y: auto;
}

menu {
  padding: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin: 0;
  flex-wrap: wrap;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.dialog-enter-active {
  transition: all 0.3s ease-out;
}

.dialog-leave-active {
  transition: all 0.3s ease-in;
}

.dialog-enter-to,
.dialog-leave-from {
  opacity: 1;
  transform: scale(1);
}

@media (min-width: 768px) {
  dialog {
    top: 20vh;
    left: calc(50% - 20rem);
    width: 40rem;
    max-height: 70vh;
  }

  header h2 {
    font-size: 1.5rem;
  }

  section {
    max-height: calc(70vh - 8rem);
  }
}

@media (max-width: 480px) {
  dialog {
    top: 2vh;
    left: 2.5%;
    width: 95%;
    max-height: 96vh;
    border-radius: 8px;
  }

  header {
    padding: 0.75rem;
  }

  header h2 {
    font-size: 1.1rem;
  }

  section {
    padding: 0.75rem;
    max-height: calc(96vh - 7rem);
  }

  menu {
    padding: 0.75rem;
    justify-content: center;
  }
}
</style>