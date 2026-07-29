<script setup>
import { ref, computed, watch, inject } from 'vue'
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
import { fetchHistory, exportCSV, exportJSON } from '../api.js'
import DateRangePicker from '../components/DateRangePicker.vue'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler)

const toast = inject('toast')

async function doExportCSV() {
  try { await exportCSV(startDate.value, endDate.value) }
  catch (e) { toast(e.message, 'error') }
}
async function doExportJSON() {
  try { await exportJSON(startDate.value, endDate.value) }
  catch (e) { toast(e.message, 'error') }
}

const now = new Date()
const weekAgo = new Date(now.getTime() - 7 * 86400000)

const startDate = ref(weekAgo.toISOString())
const endDate = ref(now.toISOString())
const limit = ref(100)
const interval = ref('raw')
const loading = ref(false)
const data = ref([])

const intervals = ['raw', '1min', '5min', '1hour']

async function load() {
  loading.value = true
  try {
    const res = await fetchHistory({
      start_date: startDate.value,
      end_date: endDate.value,
      limit: limit.value,
      interval: interval.value === 'raw' ? undefined : interval.value,
    })
    data.value = res.data || []
  } catch (e) {
    toast(e.message)
  } finally {
    loading.value = false
  }
}

const labels = computed(() => data.value.map(d => new Date(d.recorded_at).toLocaleString()))

const tempChart = computed(() => ({
  labels: labels.value,
  datasets: [
    {
      label: 'Temperature (°C)',
      data: data.value.map(d => d.temperature),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,0.1)',
      fill: true,
      tension: 0.3,
    },
    {
      label: 'Humidity (%)',
      data: data.value.map(d => d.humidity),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.1)',
      fill: true,
      tension: 0.3,
    },
  ],
}))

const gasChart = computed(() => ({
  labels: labels.value,
  datasets: [
    {
      label: 'CO (ppm)',
      data: data.value.map(d => d.co_ppm),
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239,68,68,0.1)',
      fill: true,
      tension: 0.3,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
  scales: {
    x: { ticks: { color: '#64748b', maxTicksLimit: 10 }, grid: { color: '#1e293b' } },
    y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
  },
}

watch([startDate, endDate, limit, interval], () => load(), { immediate: true })
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end gap-4">
      <DateRangePicker v-model:model-start="startDate" v-model:model-end="endDate" />
      <label class="text-xs text-slate-400">
        Interval
        <select v-model="interval" class="ml-1 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs">
          <option v-for="i in intervals" :key="i" :value="i">{{ i }}</option>
        </select>
      </label>
      <label class="text-xs text-slate-400">
        Limit
        <input v-model.number="limit" type="number" min="1" max="10000" class="ml-1 w-20 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs" />
      </label>
      <div class="flex gap-2">
        <button
          @click="doExportCSV"
          class="text-xs px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
        >
          Export CSV
        </button>
        <button
          @click="doExportJSON"
          class="text-xs px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
        >
          Export JSON
        </button>
      </div>
    </div>

    <div v-if="loading" class="space-y-4">
      <div class="h-64 bg-slate-800 rounded-xl animate-pulse" />
      <div class="h-64 bg-slate-800 rounded-xl animate-pulse" />
    </div>

    <template v-else-if="data.length">
      <div class="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h3 class="text-sm font-medium text-slate-300 mb-3">Temperature & Humidity</h3>
        <div class="h-64">
          <Line :data="tempChart" :options="chartOptions" />
        </div>
      </div>
      <div class="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h3 class="text-sm font-medium text-slate-300 mb-3">CO Level</h3>
        <div class="h-64">
          <Line :data="gasChart" :options="chartOptions" />
        </div>
      </div>
    </template>
    <p v-else class="text-center text-slate-500 py-12">No data for selected range</p>

    <div v-if="data.length" class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-700/50">
            <tr>
              <th class="text-left px-4 py-2 text-slate-400 font-medium">Timestamp</th>
              <th class="text-left px-4 py-2 text-slate-400 font-medium">Temp (°C)</th>
              <th class="text-left px-4 py-2 text-slate-400 font-medium">Humidity (%)</th>
              <th class="text-left px-4 py-2 text-slate-400 font-medium">CO (ppm)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in data" :key="d.id" class="border-t border-slate-700/50 hover:bg-slate-700/30">
              <td class="px-4 py-2 text-slate-400 text-xs">{{ new Date(d.recorded_at).toLocaleString() }}</td>
              <td class="px-4 py-2 text-slate-200">{{ d.temperature }}</td>
              <td class="px-4 py-2 text-slate-200">{{ d.humidity }}</td>
              <td class="px-4 py-2 text-slate-200">{{ d.co_ppm }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
