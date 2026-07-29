<script setup>
const props = defineProps({
  modelStart: { type: String, required: true },
  modelEnd: { type: String, required: true },
})

const emit = defineEmits(['update:modelStart', 'update:modelEnd'])

function start(d) {
  const local = new Date(d).toISOString().slice(0, 16)
  emit('update:modelStart', new Date(local).toISOString())
}

function end(d) {
  const local = new Date(d).toISOString().slice(0, 16)
  emit('update:modelEnd', new Date(local).toISOString())
}

function toLocal(iso) {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 16)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <label class="text-xs text-slate-400">
      Start
      <input
        type="datetime-local"
        :value="toLocal(modelStart)"
        @input="start($event.target.value)"
        class="ml-1 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs"
      />
    </label>
    <label class="text-xs text-slate-400">
      End
      <input
        type="datetime-local"
        :value="toLocal(modelEnd)"
        @input="end($event.target.value)"
        class="ml-1 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs"
      />
    </label>
  </div>
</template>
