# NetFlux Optimizer

Modern desktop network routing + traffic optimization UI (simulation-ready).

## Tech

- Electron + Vite (electron-vite)
- React + TypeScript
- TailwindCSS
- Recharts (animated charts)
- Framer Motion (micro-interactions)
- Lucide React (icons)

## Features implemented

- Dashboard (live ping graph, loss, quality score, Optimize Now)
- Routing Control (modes + premium locking after trial)
- Network Analyzer (diagnostics, trace placeholder, bandwidth chart)
- Optimization Settings (toggles, persistence, start on boot, minimize to tray)
- Logs & Reports (session log export from userData)
- Account & Subscription (mock auth UI + trial status)
- 30-day free trial (starts on first launch, stored locally)
- Upgrade modal with pricing + payment method placeholders
- Splash screen
- System tray (double-click to show, quick start/stop)

## Run

1. Install dependencies:

```bash
npm install
```

2. Start in dev mode:

```bash
npm run dev
```

## Project structure

- `src/main` Electron main process (engine, tray, trial/settings, IPC)
- `src/preload` Secure preload bridge (`window.netflux.*`)
- `src/renderer` React UI

## Notes

- Optimization/routing is currently **simulated** via a mock engine emitting samples every second.
- Payment, auth, and deep network control are UI placeholders and are API-ready for later integration.
