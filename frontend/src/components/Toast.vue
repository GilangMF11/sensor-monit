<script setup>
defineProps({ toasts: { type: Array, required: true } })
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
    <div
      v-for="t in toasts"
      :key="t.id"
      :class="[
        'px-4 py-3 rounded-lg text-sm shadow-lg transition-all',
        t.type === 'error' ? 'bg-red-600 text-white' : t.type === 'warning' ? 'bg-amber-600 text-white' : 'bg-green-600 text-white',
      ]"
    >
      {{ t.message }}
    </div>
  </div>
</template>
