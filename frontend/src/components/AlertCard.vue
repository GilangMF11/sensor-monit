<script setup>
import { ref } from 'vue'

const props = defineProps({
  alert: { type: Object, required: true },
  onResolve: { type: Function, required: true },
})

const resolving = ref(false)
const note = ref('')

const severityColors = {
  CRITICAL: 'border-l-red-500 bg-red-500/5',
  WARNING: 'border-l-amber-500 bg-amber-500/5',
  INFO: 'border-l-blue-500 bg-blue-500/5',
}

const severityBadges = {
  CRITICAL: 'bg-red-500/20 text-red-400',
  WARNING: 'bg-amber-500/20 text-amber-400',
  INFO: 'bg-blue-500/20 text-blue-400',
}

async function handleResolve() {
  resolving.value = true
  try {
    await props.onResolve(props.alert.id, note.value)
  } finally {
    resolving.value = false
  }
}

function formatDate(d) {
  return new Date(d).toLocaleString()
}
</script>

<template>
  <div
    :class="[
      'p-4 rounded-xl border-l-4 transition-colors',
      severityColors[alert.severity] || severityColors.INFO,
    ]"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span
            :class="[
              'px-2 py-0.5 rounded text-xs font-medium',
              severityBadges[alert.severity] || severityBadges.INFO,
            ]"
          >
            {{ alert.severity }}
          </span>
          <span class="text-sm text-slate-300 font-medium">{{ alert.type }}</span>
        </div>
        <p class="text-sm text-slate-400 mb-1">{{ alert.message }}</p>
        <div class="flex gap-4 text-xs text-slate-500">
          <span>Value: {{ alert.value }}</span>
          <span>Threshold: {{ alert.threshold }}</span>
          <span>{{ formatDate(alert.created_at) }}</span>
        </div>
      </div>
      <div v-if="!alert.resolved" class="flex-shrink-0">
        <button
          v-if="!note"
          @click="note = ''"
          class="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
        >
          Resolve
        </button>
        <div v-else class="flex items-center gap-1">
          <input
            v-model="note"
            placeholder="Note"
            class="w-28 text-xs px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200"
          />
          <button
            :disabled="resolving"
            @click="handleResolve"
            class="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-500 disabled:opacity-50"
          >
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <button
            @click="note = ''"
            class="text-xs px-2 py-1 rounded bg-slate-600 text-slate-300 hover:bg-slate-500"
          >
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div v-else class="text-xs text-green-500 flex-shrink-0">
        Resolved {{ formatDate(alert.resolved_at) }}
      </div>
    </div>
  </div>
</template>
