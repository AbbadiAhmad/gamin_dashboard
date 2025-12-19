<template>
  <div class="card">
    <slot></slot>
  </div>
</template>

<style scoped>
.card {
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.26);
  padding: 1rem;
  margin: 2rem auto;
  max-width: 40rem;
  width: 100%;
}

@media (max-width: 768px) {
  .card {
    margin: 1rem auto;
    padding: 1rem 0.75rem;
    border-radius: 8px;
    max-width: 95%;
  }
}

@media (max-width: 480px) {
  .card {
    margin: 0.75rem auto;
    padding: 0.75rem 0.5rem;
    border-radius: 6px;
    max-width: 98%;
  }
}
</style>