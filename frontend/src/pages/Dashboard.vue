<script setup>
import { ref, computed, onMounted, onUnmounted, inject, shallowRef } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js'
import { fetchLatest, fetchSystemStatus } from '../api.js'
import StatCard from '../components/StatCard.vue'
import StatusDot from '../components/StatusDot.vue'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler)

const toast = inject('toast')

const sensorData = ref(null)
const loadingSensor = ref(true)
const systemStatus = ref(null)
const loadingSystem = ref(true)

const MAX_BUFFER = 30
const buffer = shallowRef([])
let lastId = null

let timer1, timer2

async function loadLatest() {
  try {
    const data = await fetchLatest()
    sensorData.value = data
    if (data && data.id !== lastId) {
      lastId = data.id
      const next = [...buffer.value, data]
      if (next.length > MAX_BUFFER) next.shift()
      buffer.value = next
    }
  } catch (e) {
    toast(e.message)
  } finally {
    loadingSensor.value = false
  }
}

async function loadSystem() {
  try {
    systemStatus.value = await fetchSystemStatus()
  } catch {
    // silent
  } finally {
    loadingSystem.value = false
  }
}

const chartLabels = computed(() => buffer.value.map(d => {
  const t = new Date(d.recorded_at)
  return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}))

const tempHumChart = computed(() => ({
  labels: chartLabels.value,
  datasets: [
    {
      label: 'Temp °C',
      data: buffer.value.map(d => d.temperature),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 1.5,
    },
    {
      label: 'Hum %',
      data: buffer.value.map(d => d.humidity),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 1.5,
    },
  ],
}))

const gasChart = computed(() => ({
  labels: chartLabels.value,
  datasets: [
    {
      label: 'CO ppm',
      data: buffer.value.map(d => d.co_ppm),
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239,68,68,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 1.5,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 500 },
  interaction: { intersect: false, mode: 'index' },
  plugins: {
    legend: { labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 12, padding: 8 } },
  },
  scales: {
    x: { display: false },
    y: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: '#1e293b' } },
  },
}

onMounted(() => {
  loadLatest()
  loadSystem()
  timer1 = setInterval(loadLatest, 5000)
  timer2 = setInterval(loadSystem, 30000)
})

onUnmounted(() => {
  clearInterval(timer1)
  clearInterval(timer2)
})

function overallColor(s) {
  return s === 'HEALTHY' ? 'bg-green-500' : s === 'DEGRADED' ? 'bg-amber-500' : 'bg-red-500'
}
</script>

<template>
  <div class="space-y-4 min-h-full flex flex-col">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-shrink-0">
      <StatCard title="Temperature" :value="sensorData?.temperature" unit="°C" :loading="loadingSensor" :variant="sensorData?.temperature > 35 ? 'danger' : sensorData?.temperature > 28 ? 'warning' : 'default'">
        <template #icon><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"/></svg></template>
      </StatCard>
      <StatCard title="Humidity" :value="sensorData?.humidity" unit="%" :loading="loadingSensor" :variant="sensorData?.humidity > 80 || sensorData?.humidity < 30 ? 'warning' : 'default'">
        <template #icon><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3c-4.97 6-9 10.5-9 14a9 9 0 0018 0c0-3.5-4.03-8-9-14z"/></svg></template>
      </StatCard>
      <StatCard
        title="CO Level"
        :value="sensorData?.co_ppm"
        unit="ppm"
        :loading="loadingSensor"
        :variant="sensorData?.co_ppm > 100 ? 'danger' : sensorData?.co_ppm > 35 ? 'warning' : 'default'"
      >
        <template #icon><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/></svg></template>
      </StatCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1">
      <div class="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col min-h-0">
        <h3 class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 flex-shrink-0">Temperature & Humidity</h3>
        <div class="flex-1 min-h-0">
          <Line v-if="buffer.length" :data="tempHumChart" :options="chartOptions" />
          <div v-else class="h-full flex items-center justify-center text-xs text-slate-500">Waiting for data...</div>
        </div>
      </div>
      <div class="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col min-h-0">
        <h3 class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 flex-shrink-0">CO Level</h3>
        <div class="flex-1 min-h-0">
          <Line v-if="buffer.length" :data="gasChart" :options="chartOptions" />
          <div v-else class="h-full flex items-center justify-center text-xs text-slate-500">Waiting for data...</div>
        </div>
      </div>
    </div>

    <div class="bg-slate-800 rounded-xl p-5 border border-slate-700 flex-shrink-0">
      <h3 class="text-sm font-medium text-slate-300 mb-4">System Status</h3>
      <div v-if="loadingSystem" class="space-y-3">
        <div v-for="i in 4" :key="i" class="h-10 bg-slate-700 rounded animate-pulse" />
      </div>
      <div v-else-if="systemStatus" class="space-y-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-400">API Server</span>
          <span class="flex items-center gap-2">
            <StatusDot :status="systemStatus.components?.api_server?.status" />
            <span class="text-slate-300">{{ systemStatus.components?.api_server?.status || '--' }}</span>
          </span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-400">Database</span>
          <span class="flex items-center gap-2">
            <StatusDot :status="systemStatus.components?.database?.status" />
            <span class="text-slate-300">{{ systemStatus.components?.database?.status || '--' }}</span>
          </span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-400">ESP32 Device</span>
          <span class="flex items-center gap-2">
            <StatusDot :status="systemStatus.components?.esp32_device?.status" />
            <span class="text-slate-300">{{ systemStatus.components?.esp32_device?.status || '--' }}</span>
          </span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-400">Disk</span>
          <span class="text-slate-300">{{ systemStatus.components?.disk_space?.used_percent || '--' }}% used</span>
        </div>
      </div>
      <p v-else class="text-sm text-slate-500">Unavailable</p>

      <div v-if="systemStatus" class="mt-4 pt-3 border-t border-slate-700 flex items-center gap-2 text-xs">
        <span :class="['w-2 h-2 rounded-full', overallColor(systemStatus.overall_status)]" />
        <span class="text-slate-400">Overall:</span>
        <span class="text-slate-300 font-medium">{{ systemStatus.overall_status }}</span>
      </div>
    </div>
  </div>
</template>
