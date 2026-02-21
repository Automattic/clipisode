# Clipisode WordPress Plugin

Enables creators and brands to collect video replies from visitors, moderate submissions, and render finished clipisode videos.

## Dev Setup

```bash
npm install
npm run build    # production build
npm run start    # watch mode
```

## Structure

- `assets/themes/` — Static theme assets (images) served at runtime
- `assets/templates/` — PHP templates for invitation and terms pages
- `includes/` — PHP: REST API, database, media handling, admin, post types
- `src/` — TypeScript/React admin UI + SCSS
- `src/flow/` — Invitation page frontend (vanilla TS, block renders)
- `build/` — Compiled output (gitignored)
