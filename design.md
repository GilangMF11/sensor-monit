# Server Room Monitoring System - Frontend Design

## Tech Stack
- **Framework:** Vue 3 (Composition API + `<script setup>`)
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v3
- **Router:** Vue Router 4 (hash mode)
- **Charts:** Chart.js via vue-chartjs
- **HTTP:** fetch (native, no axios — zero dependency)

## Color Palette
```
bg-dark:    #0f172a (slate-900)
bg-card:    #1e293b (slate-800)
bg-input:   #334155 (slate-700)
text-muted: #94a3b8 (slate-400)
accent:     #3b82f6 (blue-500)
danger:     #ef4444 (red-500)
warning:    #f59e0b (amber-500)
success:    #22c55e (green-500)
```

## Pages

### 1. Login (`/login`)
**Purpose:** JWT authentication.
- Centered card on dark bg
- Email + password fields, "Login" button
- Error toast on 401
- On success: store token in localStorage, redirect to `/`

### 2. Dashboard (`/`)
**Purpose:** Real-time overview, landing page after login.
- Top row: 4 stat cards (temperature, humidity, CO ppm, LPG ppm) — each shows current value + trend indicator
- Middle row: system status panel (API, DB, ESP32, disk)
- Bottom row: latest 5 alerts (mini list)
- Auto-refresh latest data every 10s via `GET /sensor-data/latest`
- Refresh system status every 30s via `GET /system/status`

### 3. History (`/history`)
**Purpose:** Sensor data over time with chart + table.
- Date range picker (start/end ISO input)
- Interval selector: raw / 1min / 5min / 1hour
- Limit input
- Multi-line chart (temperature, humidity on dual Y-axis; CO, LPG on own chart)
- Table below chart with pagination
- Export buttons: CSV, JSON (trigger `GET /sensor-data/export/csv` and `/json`)

### 4. Statistics (`/statistics`)
**Purpose:** Aggregated stats for a date range.
- Date range picker
- 4 metric cards: each shows min/max/avg/stdev/count for temp, humidity, CO, LPG
- Bar chart comparing min/max/avg across metrics

### 5. Alerts (`/alerts`)
**Purpose:** View, filter, resolve alerts.
- Filter bar: severity dropdown, resolved toggle, limit
- Alert list: cards with color-coded severity border
- Each card: type, value vs threshold, severity badge, timestamp, resolve button
- Resolve: opens inline note input → `PUT /alerts/{id}/resolve`
- Pagination

### 6. Alert Config (`/config`)
**Purpose:** Set alert thresholds.
- 4 sections: temperature, humidity, CO, LPG
- Each: enabled toggle, warning threshold input, critical threshold input
- Humidity has low/high ranges (4 inputs)
- Save button → `PUT /alert-config`

## Layout
- **Sidebar** (fixed left, collapsible on mobile):
  - Logo/app name "Server Room"
  - Nav links: Dashboard, History, Statistics, Alerts, Config
  - Bottom: logout button
- **Navbar** (top, sticky):
  - Page title
  - System status dot (green/amber/red from health check)
  - User email display
- **Main content area**: scrollable, padded

## Components (Reusable)

| Component | Props | Usage |
|-----------|-------|-------|
| `StatCard.vue` | title, value, unit, trend, loading | Dashboard metric cards |
| `AlertCard.vue` | alert object, onResolve | Alert list items |
| `DateRangePicker.vue` | modelStart, modelEnd | History, Stats |
| `StatusDot.vue` | status ("RUNNING"/"CONNECTED"/"DOWN") | System status |
| `AppSidebar.vue` | — | Layout sidebar |
| `AppNavbar.vue` | — | Layout top bar |
| `Toast.vue` | (provide/inject) | Global toast notifications |

## Routes
```
/login      → Login.vue         (public)
/           → Dashboard.vue     (auth required)
/history    → History.vue       (auth required)
/statistics → Statistics.vue    (auth required)
/alerts     → Alerts.vue        (auth required)
/config     → AlertConfig.vue   (auth required)
```

## Auth Flow
1. Token stored in `localStorage` under key `auth_token`
2. `router.beforeEach` checks token — redirects to `/login` if missing
3. All API calls include `Authorization: Bearer <token>` header
4. On 401 response → clear token, redirect to `/login`
5. Login page redirects to `/` if token already exists

## API Layer
- Single file `src/api.js` with functions: `login()`, `fetchLatest()`, `fetchHistory()`, `fetchStatistics()`, `fetchAlerts()`, `resolveAlert()`, `fetchAlertConfig()`, `updateAlertConfig()`, `fetchSystemStatus()`
- All use native `fetch()` with error handling
- Token auto-attach from localStorage
- Rate limit header parsing (optional, show warning toast)

## Responsive
- Sidebar collapses to icons on `md` breakpoint, hidden on `sm` with hamburger toggle
- Stat cards: 4 columns → 2 columns → 1 column
- Charts resize with container
- Tables scroll horizontally on mobile

## Loading / Empty / Error States
- Every data-fetching view has 3 states:
  - **Loading:** skeleton pulse cards / spinner
  - **Empty:** "No data" message with icon
  - **Error:** error message with retry button

## No Auth Pages
Only `/login` is public. All others redirect to `/login` if no token.
