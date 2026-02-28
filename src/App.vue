<script setup lang="ts"></script>

<template>
  <main class="d-flex flex-column overflow-hidden flex-fill min-height-0" style="height: 100vh">
    <RouterView />
  </main>
</template>

<style scoped>
.min-height-0 {
  min-height: 0;
}

.flex-fill {
  flex: 1 1 auto;
}

.flex-shrink-0 {
  flex-shrink: 0;
}
</style>
