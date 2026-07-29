<script setup>
defineProps({
  title: { type: String, required: true },
  value: [String, Number],
  unit: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  variant: { type: String, default: 'default' },
})

const styles = {
  default: { bar: 'bg-blue-500', bg: 'from-blue-500/10 to-blue-500/5', text: 'text-blue-400', ring: 'ring-blue-500/20' },
  warning: { bar: 'bg-amber-500', bg: 'from-amber-500/10 to-amber-500/5', text: 'text-amber-400', ring: 'ring-amber-500/20' },
  danger:  { bar: 'bg-red-500',   bg: 'from-red-500/10 to-red-500/5',   text: 'text-red-400',   ring: 'ring-red-500/20' },
}
</script>

<template>
  <div class="bg-slate-800/80 rounded-2xl ring-1 ring-slate-700/50 overflow-hidden">
    <div :class="['h-1', styles[variant]?.bar || styles.default.bar]" />
    <div :class="['p-5 bg-gradient-to-br', styles[variant]?.bg || styles.default.bg]">
      <div class="flex items-center justify-between">
        <div class="min-w-0">
          <p class="text-xs font-medium text-slate-500 uppercase tracking-wider">{{ title }}</p>
          <template v-if="loading">
            <div class="mt-1.5 h-9 w-28 bg-slate-700/50 rounded-lg animate-pulse" />
          </template>
          <template v-else>
            <p class="mt-1 text-3xl font-bold tracking-tight text-white tabular-nums">
              {{ value ?? '--' }}
              <span v-if="unit" class="text-sm font-medium text-slate-500 ml-1">{{ unit }}</span>
            </p>
          </template>
        </div>
        <div :class="['flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center', styles[variant]?.ring || styles.default.ring, styles[variant]?.text || 'text-blue-400']">
          <slot name="icon" />
        </div>
      </div>
    </div>
  </div>
</template>
