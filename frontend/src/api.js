const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'

function headers() {
  const h = { 'Content-Type': 'application/json',
    'X-Requested-With' : 'XMLHttpRequest'
   }
  const t = localStorage.getItem('auth_token')
  if (t) h['Authorization'] = `Bearer ${t}`
  return h
}

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), ...options })
  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    window.location.href = `${import.meta.env.BASE_URL}login`
    throw new Error('Unauthorized')
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || data.error?.message || 'Request failed')
  return data
}

export function login(email, password) {
  return fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify({ email, password }),
  }).then(r => r.json().then(d => {
    if (!r.ok) throw new Error(d.message || 'Login failed')
    return d
  }))
}

export function fetchLatest() {
  return req('/sensor-data/latest').then(d => d.data)
}

export function fetchHistory({ start_date, end_date, limit, interval }) {
  const p = new URLSearchParams({ start_date, end_date })
  if (limit) p.set('limit', limit)
  if (interval) p.set('interval', interval)
  return req(`/sensor-data/history?${p}`)
}

export function fetchStatistics(start_date, end_date) {
  return req(`/sensor-data/statistics?start_date=${start_date}&end_date=${end_date}`)
}

export function fetchAlerts({ limit, offset, severity, resolved } = {}) {
  const p = new URLSearchParams()
  if (limit) p.set('limit', limit)
  if (offset) p.set('offset', offset)
  if (severity) p.set('severity', severity)
  if (resolved !== undefined) p.set('resolved', resolved)
  return req(`/alerts?${p}`)
}

export function resolveAlert(id, note) {
  return fetch(`${BASE}/alerts/${id}/resolve`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ note }),
  }).then(r => r.json())
}

export function fetchAlertConfig() {
  return req('/alert-config').then(d => d.data)
}

export function updateAlertConfig(config) {
  return fetch(`${BASE}/alert-config`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(config),
  }).then(r => r.json())
}

export function fetchSystemStatus() {
  return req('/system/status').then(d => d.data)
}

async function downloadFile(path, filename) {
  const url = `${BASE}${path}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function exportCSV(start_date, end_date) {
  return downloadFile(`/sensor-data/export/csv?start_date=${start_date}&end_date=${end_date}`, 'sensor-data.csv')
}

export function exportJSON(start_date, end_date) {
  return downloadFile(`/sensor-data/export/json?start_date=${start_date}&end_date=${end_date}`, 'sensor-data.json')
}
