<template>
  <nav class="breadcrumb">
    <router-link to="/" class="breadcrumb-item">Home</router-link>
    <span v-for="(crumb, index) in crumbs" :key="index" class="breadcrumb-separator">
      <span class="separator-icon">›</span>
      <router-link
        v-if="crumb.to"
        :to="crumb.to"
        class="breadcrumb-item"
      >
        {{ crumb.label }}
      </router-link>
      <span v-else class="breadcrumb-item current">{{ crumb.label }}</span>
    </span>
  </nav>
</template>

<script>
export default {
  props: {
    crumbs: {
      type: Array,
      required: true,
      // Format: [{ label: 'Teams', to: '/teams' }, { label: 'Edit Team' }]
    }
  }
};
</script>

<style scoped>
.breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 0.75rem 0;
  margin-bottom: 1rem;
  font-size: 0.95rem;
  gap: 0.25rem;
}

.breadcrumb-item {
  color: #3d008d;
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: all 0.2s;
}

.breadcrumb-item:hover {
  background-color: #f0e6fd;
  color: #2d006d;
}

.breadcrumb-item.current {
  color: #666;
  font-weight: 500;
  cursor: default;
}

.breadcrumb-separator {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.separator-icon {
  color: #999;
  font-size: 1.2rem;
  user-select: none;
}

@media (max-width: 768px) {
  .breadcrumb {
    font-size: 0.9rem;
    padding: 0.5rem 0;
  }

  .breadcrumb-item {
    padding: 0.2rem 0.4rem;
  }
}

@media (max-width: 480px) {
  .breadcrumb {
    font-size: 0.85rem;
    gap: 0.1rem;
  }

  .breadcrumb-item {
    padding: 0.15rem 0.3rem;
  }

  .separator-icon {
    font-size: 1rem;
  }
}
</style>
