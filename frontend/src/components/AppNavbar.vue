<script setup>
import { computed, inject, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

defineEmits(['toggleSidebar'])

const route = useRoute()
const router = useRouter()
const fullscreen = inject('fullscreen')
const alertCount = inject('alertCount', ref(0))

const titles = {
  Dashboard: 'Dashboard',
  History: 'History',
  Statistics: 'Statistics',
  Alerts: 'Alerts',
  AlertConfig: 'Alert Configuration',
}

const email = computed(() => {
  try { return localStorage.getItem('auth_email') || '' } catch { return '' }
})
</script>

<template>
  <header class="sticky top-0 z-30 bg-slate-800/80 backdrop-blur border-b border-slate-700 px-4 py-3 flex items-center gap-4">
    <button
      @click="$emit('toggleSidebar')"
      class="md:hidden text-slate-400 hover:text-slate-200"
    >
      <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
    <h2 class="text-lg font-semibold text-slate-200 flex-1">
      {{ titles[route.name] || 'Server Room' }}
    </h2>
    <button
      v-if="route.name === 'Dashboard'"
      @click="fullscreen = !fullscreen"
      class="text-xs px-2 py-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
      :title="fullscreen ? 'Exit fullscreen' : 'Fullscreen'"
    >
      <svg v-if="!fullscreen" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 3 21 3 21 9"/>
        <polyline points="9 21 3 21 3 15"/>
        <line x1="21" y1="3" x2="14" y2="10"/>
        <line x1="3" y1="21" x2="10" y2="14"/>
      </svg>
      <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 8 4 4 8 4"/>
        <polyline points="20 16 20 20 16 20"/>
        <line x1="4" y1="4" x2="10" y2="10"/>
        <line x1="20" y1="20" x2="14" y2="14"/>
      </svg>
    </button>
    <button
      @click="router.push('/alerts')"
      class="relative text-slate-400 hover:text-slate-200 transition-colors"
      title="Alerts"
    >
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <span
        v-if="alertCount > 0"
        class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none"
      >{{ alertCount > 99 ? '99' : alertCount }}</span>
    </button>
    <span class="text-xs text-slate-500">{{ email }}</span>
  </header>
</template>
