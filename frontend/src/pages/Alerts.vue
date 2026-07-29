<script setup>
import { ref, watch, onMounted, inject } from 'vue'
import { fetchAlerts, resolveAlert } from '../api.js'
import AlertCard from '../components/AlertCard.vue'

const toast = inject('toast')

const alerts = ref([])
const loading = ref(false)
const severity = ref('')
const resolved = ref('')
const limit = ref(50)
const offset = ref(0)
const total = ref(0)

async function load() {
  loading.value = true
  try {
    const res = await fetchAlerts({
      limit: limit.value,
      offset: offset.value,
      severity: severity.value || undefined,
      resolved: resolved.value === '' ? undefined : resolved.value === 'true',
    })
    alerts.value = res.data || []
    total.value = res.pagination?.total || 0
  } catch (e) {
    toast(e.message)
  } finally {
    loading.value = false
  }
}

async function handleResolve(id, note) {
  try {
    await resolveAlert(id, note)
    toast(`Alert #${id} resolved`, 'success')
    load()
  } catch (e) {
    toast(e.message)
  }
}

const pages = () => Math.ceil(total.value / limit.value) || 1
const page = () => Math.floor(offset.value / limit.value) + 1

function goPage(p) {
  offset.value = (p - 1) * limit.value
}

watch([severity, resolved, limit, offset], () => load(), { immediate: true })
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end gap-4">
      <label class="text-xs text-slate-400">
        Severity
        <select v-model="severity" class="ml-1 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs">
          <option value="">All</option>
          <option value="CRITICAL">Critical</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
      </label>
      <label class="text-xs text-slate-400">
        Resolved
        <select v-model="resolved" class="ml-1 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs">
          <option value="">All</option>
          <option value="false">Active</option>
          <option value="true">Resolved</option>
        </select>
      </label>
      <label class="text-xs text-slate-400">
        Limit
        <input v-model.number="limit" type="number" min="1" max="100" class="ml-1 w-20 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs" />
      </label>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="h-20 bg-slate-800 rounded-xl animate-pulse border-l-4 border-l-slate-700" />
    </div>

    <div v-else-if="alerts.length" class="space-y-3">
      <AlertCard
        v-for="alert in alerts"
        :key="alert.id"
        :alert="alert"
        :on-resolve="handleResolve"
      />
    </div>
    <p v-else class="text-center text-slate-500 py-12">No alerts found</p>

    <div v-if="total > limit" class="flex items-center justify-center gap-2 text-xs">
      <button
        :disabled="offset === 0"
        @click="goPage(page() - 1)"
        class="px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50"
      >
        Prev
      </button>
      <span class="text-slate-400">Page {{ page() }} of {{ pages() }}</span>
      <button
        :disabled="offset + limit >= total"
        @click="goPage(page() + 1)"
        class="px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50"
      >
        Next
      </button>
    </div>
  </div>
</template>
