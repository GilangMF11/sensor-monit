<script setup>
defineProps({ status: { type: String, required: true } })

const colors = {
  RUNNING: 'bg-green-500',
  CONNECTED: 'bg-green-500',
  HEALTHY: 'bg-green-500',
  DOWN: 'bg-red-500',
  DISCONNECTED: 'bg-red-500',
  UNKNOWN: 'bg-amber-500',
}
</script>

<template>
  <span
    :class="['inline-block w-2.5 h-2.5 rounded-full', colors[status] || colors.UNKNOWN]"
  />
</template>
