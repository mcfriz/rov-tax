# ROV TAX

ROV TAX is a single-user, offline-first Vite + React + TypeScript app.

## Local development

```bash
npm install
npm run dev
```

## GitHub Pages deploy

This repo is configured for GitHub Pages with a relative base path.

1. Build the app:

```bash
npm run build
```

2. Publish the `dist` folder to your GitHub Pages branch (commonly `gh-pages`) and enable Pages in the repo settings.

If you use a CI workflow, make sure it runs `npm ci`, `npm run build`, and publishes `dist`.

## Routing note

This app does not use a client-side router, so refreshes work on GitHub Pages. If you add routing later, prefer hash-based routing or a Pages 404 fallback.