<script setup>
import { ref, onMounted, inject } from 'vue'
import { fetchAlertConfig, updateAlertConfig } from '../api.js'

const toast = inject('toast')
const loading = ref(true)
const saving = ref(false)

const config = ref({
  temperature: { warning_threshold: 28, critical_threshold: 35, enabled: true },
  humidity: { warning_low: 30, warning_high: 80, critical_low: 20, critical_high: 90, enabled: true },
  co: { warning_threshold: 35, critical_threshold: 100, enabled: true },
})

onMounted(async () => {
  try {
    const data = await fetchAlertConfig()
    if (data) Object.assign(config.value, data)
  } catch (e) {
    toast(e.message)
  } finally {
    loading.value = false
  }
})

async function save() {
  saving.value = true
  try {
    await updateAlertConfig(config.value)
    toast('Configuration saved', 'success')
  } catch (e) {
    toast(e.message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="h-40 bg-slate-800 rounded-xl animate-pulse" />
    </div>

    <template v-else>
      <div class="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-medium text-slate-300 flex items-center gap-2">
            <svg class="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>
            Temperature
          </h3>
          <label class="flex items-center gap-2 text-xs">
            <input v-model="config.temperature.enabled" type="checkbox" class="rounded" />
            <span class="text-slate-400">Enabled</span>
          </label>
        </div>
        <p class="text-[10px] text-slate-600 -mt-2 mb-4">ISO/IEC 30134 — ASHRAE TC9.9: 18–27 °C allowable</p>
        <div class="grid grid-cols-2 gap-4">
          <label class="text-xs text-slate-400">
            Warning Threshold (°C)
            <input
              v-model.number="config.temperature.warning_threshold"
              type="number"
              step="0.1"
              class="w-full mt-1 px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm"
            />
          </label>
          <label class="text-xs text-slate-400">
            Critical Threshold (°C)
            <input
              v-model.number="config.temperature.critical_threshold"
              type="number"
              step="0.1"
              class="w-full mt-1 px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm"
            />
          </label>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-medium text-slate-300 flex items-center gap-2">
            <svg class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
            Humidity</h3>
          <label class="flex items-center gap-2 text-xs">
            <input v-model="config.humidity.enabled" type="checkbox" class="rounded" />
            <span class="text-slate-400">Enabled</span>
          </label>
        </div>
        <p class="text-[10px] text-slate-600 -mt-2 mb-4">ISO/IEC 30134 — ASHRAE TC9.9: 40–60 % RH recommended</p>
        <div class="grid grid-cols-2 gap-4">
          <label class="text-xs text-slate-400">
            Warning Low (%)
            <input
              v-model.number="config.humidity.warning_low"
              type="number"
              class="w-full mt-1 px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm"
            />
          </label>
          <label class="text-xs text-slate-400">
            Warning High (%)
            <input
              v-model.number="config.humidity.warning_high"
              type="number"
              class="w-full mt-1 px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm"
            />
          </label>
          <label class="text-xs text-slate-400">
            Critical Low (%)
            <input
              v-model.number="config.humidity.critical_low"
              type="number"
              class="w-full mt-1 px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm"
            />
          </label>
          <label class="text-xs text-slate-400">
            Critical High (%)
            <input
              v-model.number="config.humidity.critical_high"
              type="number"
              class="w-full mt-1 px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm"
            />
          </label>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-medium text-slate-300 flex items-center gap-2">
            <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
            CO (Carbon Monoxide)</h3>
          <label class="flex items-center gap-2 text-xs">
            <input v-model="config.co.enabled" type="checkbox" class="rounded" />
            <span class="text-slate-400">Enabled</span>
          </label>
        </div>
        <p class="text-[10px] text-slate-600 -mt-2 mb-4">OSHA PEL: 50 ppm (TWA) — IDLH: 1 200 ppm</p>
        <div class="grid grid-cols-2 gap-4">
          <label class="text-xs text-slate-400">
            Warning Threshold (ppm)
            <input
              v-model.number="config.co.warning_threshold"
              type="number"
              class="w-full mt-1 px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm"
            />
          </label>
          <label class="text-xs text-slate-400">
            Critical Threshold (ppm)
            <input
              v-model.number="config.co.critical_threshold"
              type="number"
              class="w-full mt-1 px-2 py-1.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-sm"
            />
          </label>
        </div>
      </div>
    </template>

    <div class="sticky bottom-4 flex justify-end">
      <button
        :disabled="loading || saving"
        @click="save"
        class="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
      >
        {{ saving ? 'Saving...' : 'Save Configuration' }}
      </button>
    </div>
  </div>
</template>
