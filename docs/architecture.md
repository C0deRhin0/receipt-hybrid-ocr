# Receipt Hybrid OCR Architecture

## Repository layout

```text
codebase/
├── backend/              # Express runtime, OCR/AI adapters, LAN/HTTPS bootstrap
│   ├── index.js          # Runtime entrypoint
│   ├── lib/              # Existing OCR and AI provider adapters
│   ├── preprocess.py
│   └── src/
│       ├── app.js
│       ├── config/
│       ├── http/routes/
│       ├── services/
│       └── utils/
├── frontend/             # Vite + React application
├── public/
├── scripts/              # Operational start/stop/status commands
└── docs/
```

## Architectural intent

- **Frontend** remains a standalone Vite SPA rooted in `frontend/`.
- **Backend** remains a single deployable Express service, but now separates:
  - runtime bootstrap
  - environment/path configuration
  - HTTP routes
  - receipt extraction orchestration
  - Google Sheets integration
- **Adapters** in `backend/lib/` are preserved to retain OCR and provider behavior.

## Pathing guarantees

- Frontend build output remains `frontend/dist`.
- Express still serves the built SPA and preserves `/api/extract` and `/api/sheets`.
- Scripts now target `backend/index.js` and detect `frontend/dist` correctly.
- Environment loading still uses `.env.local` at the repository root.
