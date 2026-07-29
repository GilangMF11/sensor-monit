<script setup>
import { ref, provide, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from './components/AppSidebar.vue'
import AppNavbar from './components/AppNavbar.vue'
import Toast from './components/Toast.vue'
import { fetchAlerts } from './api.js'

const route = useRoute()
const sidebarOpen = ref(false)
const fullscreen = ref(false)
const toasts = ref([])
const alertCount = ref(0)
let alertTimer = null

const SEEN_KEY = 'seen_alert_ids'

function getSeenIds() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')) }
  catch { return new Set() }
}

function saveSeenIds(ids) {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-50)))
}

function addToast(message, type = 'error', duration = 4000) {
  const id = Date.now() + Math.random()
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, duration)
}

async function pollAlerts() {
  try {
    const res = await fetchAlerts({ resolved: false, limit: 20 })
    const alerts = res.data || []
    const seenIds = getSeenIds()
    let newCount = 0

    for (const a of alerts) {
      if (!seenIds.has(a.id)) {
        seenIds.add(a.id)
        addToast(`[${a.severity}] ${a.type}: ${a.message}`,
          a.severity === 'CRITICAL' ? 'error' : 'warning', 8000)
        newCount++
      }
    }

    if (newCount > 0) saveSeenIds(seenIds)
    alertCount.value = alerts.length
  } catch {
    // silent
  }
}

function onKeydown(e) {
  if (e.key === 'Escape' && fullscreen.value) fullscreen.value = false
}

function startPolling() {
  pollAlerts()
  alertTimer = setInterval(pollAlerts, 15000)
}

function stopPolling() {
  if (alertTimer) { clearInterval(alertTimer); alertTimer = null }
}

watch(() => route.name, (name) => {
  if (name === 'Login') stopPolling()
  else { if (!alertTimer) startPolling() }
}, { immediate: true })

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  stopPolling()
})

provide('toast', addToast)
provide('fullscreen', fullscreen)
provide('alertCount', alertCount)
</script>

<template>
  <div v-if="route.name === 'Login'">
    <router-view />
  </div>
  <div v-else class="flex h-screen overflow-hidden">
    <AppSidebar v-if="!fullscreen" :open="sidebarOpen" @close="sidebarOpen = false" />
    <div class="flex-1 flex flex-col min-w-0">
      <AppNavbar v-if="!fullscreen" @toggle-sidebar="sidebarOpen = !sidebarOpen" />
      <main :class="['flex-1 overflow-auto', fullscreen ? 'p-4 md:p-6' : 'p-4 md:p-6']">
        <router-view />
      </main>
    </div>
    <div
      v-if="fullscreen"
      @click="fullscreen = false"
      title="Exit fullscreen (Esc)"
      class="fixed right-0 top-1/2 -translate-y-1/2 z-50 group cursor-pointer"
    >
      <div class="flex items-center bg-slate-800/90 border border-slate-600 border-r-0 rounded-l-lg overflow-hidden transition-all duration-300 w-10 hover:w-36">
        <span class="flex-shrink-0 w-10 h-12 flex items-center justify-center text-slate-400 group-hover:text-slate-200 transition-colors">
          <svg class="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </span>
        <span class="whitespace-nowrap text-xs text-slate-400 group-hover:text-slate-200 pr-3 transition-all duration-300 opacity-0 group-hover:opacity-100">Minimize</span>
      </div>
    </div>
    <Toast :toasts="toasts" />
  </div>
</template>
