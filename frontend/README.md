# CivicAI Nexus — Frontend

React + Vite frontend for the CivicAI Nexus grievance platform. See the
[root README](../README.md) for full setup and Docker Compose instructions.

## Structure

```
src/
├── components/   common, layout, ai, grievances, incidents, charts, maps, notifications
├── pages/        public, auth, citizen, officer, admin, shared (reused across roles)
├── context/      AuthContext, ThemeContext, ToastContext
├── hooks/        useAuth
├── services/     one module per API resource (axios, JWT-attached)
├── utils/        constants.js, helpers.js
├── routes/       ProtectedRoute (role-based guard)
├── layouts/      DashboardLayout (sidebar+topbar), PublicLayout
├── App.jsx        route tree
└── main.jsx        entry point
```

## Local development

```bash
npm install
cp .env.example .env    # VITE_API_BASE_URL, defaults to http://localhost:8000
npm run dev
```

## Build / lint

```bash
npm run build
npm run lint
```

## Notes

- Theming: light/dark/system via `ThemeContext`, toggled from Settings or the topbar.
- The citizen report form's voice input uses the browser's `SpeechRecognition` API — no
  backend round-trip needed for the common case (see `components/grievances/VoiceRecorder.jsx`).
- `GrievanceDetail`, `Incidents`, `IncidentDetail`, `Notifications`, `Profile`, and
  `Settings` live under `pages/shared/` and are reused across all three roles' route trees
  rather than duplicated per role.
