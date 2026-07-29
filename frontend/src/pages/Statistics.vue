<script setup>
import { ref, computed, watch, inject } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
} from 'chart.js'
import { fetchStatistics } from '../api.js'
import DateRangePicker from '../components/DateRangePicker.vue'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip)

const toast = inject('toast')

const now = new Date()
const weekAgo = new Date(now.getTime() - 7 * 86400000)

const startDate = ref(weekAgo.toISOString())
const endDate = ref(now.toISOString())
const loading = ref(false)
const stats = ref(null)

async function load() {
  loading.value = true
  try {
    const res = await fetchStatistics(startDate.value, endDate.value)
    stats.value = res.data
  } catch (e) {
    toast(e.message)
  } finally {
    loading.value = false
  }
}

const metrics = [
  { key: 'temperature', label: 'Temperature', unit: '°C' },
  { key: 'humidity', label: 'Humidity', unit: '%' },
  { key: 'co_ppm', label: 'CO', unit: 'ppm' },
]

const chartData = computed(() => ({
  labels: metrics.map(m => m.label),
  datasets: [
    {
      label: 'Min',
      data: metrics.map(m => stats.value?.[m.key]?.min ?? 0),
      backgroundColor: '#3b82f6',
    },
    {
      label: 'Avg',
      data: metrics.map(m => stats.value?.[m.key]?.avg ?? 0),
      backgroundColor: '#22c55e',
    },
    {
      label: 'Max',
      data: metrics.map(m => stats.value?.[m.key]?.max ?? 0),
      backgroundColor: '#ef4444',
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
  scales: {
    x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
    y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
  },
}

watch([startDate, endDate], () => load(), { immediate: true })
</script>

<template>
  <div class="space-y-6">
    <DateRangePicker v-model:model-start="startDate" v-model:model-end="endDate" />

    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 3" :key="i" class="h-32 bg-slate-800 rounded-xl animate-pulse" />
    </div>

    <template v-else-if="stats">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="m in metrics"
          :key="m.key"
          class="bg-slate-800 rounded-xl p-4 border border-slate-700"
        >
          <p class="text-xs text-slate-500 uppercase tracking-wide">{{ m.label }}</p>
          <div class="mt-2 space-y-1 text-sm">
            <div class="flex justify-between">
              <span class="text-slate-400">Min</span>
              <span class="text-slate-200">{{ stats[m.key]?.min ?? '--' }} {{ m.unit }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Max</span>
              <span class="text-slate-200">{{ stats[m.key]?.max ?? '--' }} {{ m.unit }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Avg</span>
              <span class="text-slate-200">{{ stats[m.key]?.avg ?? '--' }} {{ m.unit }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">StDev</span>
              <span class="text-slate-200">{{ stats[m.key]?.stdev ?? '--' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Count</span>
              <span class="text-slate-200">{{ stats[m.key]?.count ?? '--' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h3 class="text-sm font-medium text-slate-300 mb-3">Min / Avg / Max Comparison</h3>
        <div class="h-80">
          <Bar :data="chartData" :options="chartOptions" />
        </div>
      </div>
    </template>
    <p v-else class="text-center text-slate-500 py-12">No statistics available</p>
  </div>
</template>
