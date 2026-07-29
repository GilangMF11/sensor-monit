# monitoring-IoT Frontend

Vue 3 + Vite + Chart.js dashboard.

## Development

```bash
cp .env.example .env   # Copy and adjust API base URL
npm install
npm run dev
```

## Build

```bash
npm run build    # Output to dist/
npm run preview  # Preview production build (default :4173)
```

## Deploy with PM2

PM2 serves the Vite preview server (production build) as a daemon.

### 1. Build

```bash
npm run build
```

### 2. Start with PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

### 3. PM2 management

```bash
pm2 list              # Check status
pm2 logs frontend     # View logs
pm2 restart frontend  # Restart after rebuild
pm2 stop frontend     # Stop
pm2 delete frontend   # Remove from PM2
```

### Auto-start on boot

```bash
pm2 startup
pm2 save
```

## Project structure

```
src/
  main.js       - Vue app entry, router mount
  App.vue       - Root layout + sidebar
  router.js     - Vue Router routes
  api.js        - Axios API client
  views/        - Page components
```

## Tech stack

- Vue 3 (Composition API, `<script setup>`)
- Vite 8
- Vue Router 4
- Chart.js 4 + vue-chartjs
- Tailwind CSS v4 (Vite plugin)
