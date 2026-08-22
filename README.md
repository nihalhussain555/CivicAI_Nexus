# CivicAI Nexus

**Predictive Multimodal Grievance Intelligence & Resolution Platform**

Citizens report public problems via text, voice, image, and location. AI classifies,
prioritizes, and routes every report to the correct department, detects duplicate and
community-wide incidents, assists officers with an AI Copilot, predicts resolution time
and SLA/escalation risk, and tracks each case through to citizen verification.

---

## Stack

| Layer     | Tech                                                                 |
|-----------|-----------------------------------------------------------------------|
| Frontend  | React + Vite, React Router, Axios, Lucide React, Framer Motion, Recharts, React Leaflet |
| Backend   | FastAPI (Python)                                                     |
| Database  | MongoDB (with geospatial + text indexes)                             |
| Auth      | JWT + bcrypt + role-based access control                             |
| AI        | Provider-independent abstraction — MockAIProvider (offline demo) or OpenAI / Gemini |

## Repository layout

```
CivicAI/
├── backend/          FastAPI app, AI pipeline, seed script, tests support
├── frontend/          React + Vite app
├── tests/              pytest suite (backend)
├── conftest.py         test bootstrap (see "Running tests" below)
├── docker-compose.yml  Mongo + backend + frontend, one command
└── knowledge_base/     FAQ content used by the AI assistant's retrieval
```

---

## Quick start (Docker Compose)

The fastest way to run everything, including MongoDB:

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000 (docs at `/docs`)
- MongoDB: `mongodb://localhost:27017`

Then seed demo data (one time):

```bash
docker compose exec backend python -m app.seed.seed_data
```

Demo accounts (password for all: `Demo@123`):

| Role     | Email               |
|----------|---------------------|
| Citizen  | citizen@demo.com    |
| Officer  | officer@demo.com    |
| Admin    | admin@demo.com      |

---

## Quick start (manual, no Docker)

### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # edit MONGO_URI if not running locally on 27017
python -m app.seed.seed_data       # seeds demo departments/users/grievances/incidents
uvicorn app.main:app --reload      # http://localhost:8000
```

Requires a running MongoDB instance (local install, Docker, or Atlas) — set `MONGO_URI`
in `.env` accordingly.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env               # points at http://localhost:8000 by default
npm run dev                        # http://localhost:5173
```

---

## AI provider configuration

The platform works fully **offline** with `AI_PROVIDER=mock` (the default) — no API key
required, and every prediction is deterministic so the whole citizen → officer → admin
workflow runs end to end for demos and grading.

To use a real LLM instead, set in `backend/.env`:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

or

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-1.5-flash
```

If a real provider is misconfigured or a call fails at request time, the backend
**automatically falls back to the mock provider** for that call — the app never hard-fails
because of AI configuration. No frontend code changes are needed to switch providers.

**What's wired to real providers when configured:**
- Grievance classification, severity/urgency/priority scoring, summary, and recommended action (`/api/ai/analyze`, used by the citizen report review step)
- Officer AI Copilot briefs (`/api/grievances/{id}/copilot`)
- The general AI chat assistant (`/api/ai/chat`)
- Image captioning for uploaded photos (`/api/uploads/image`) — sends the actual image bytes to a vision-capable model
- Voice transcription for uploaded audio (`/api/uploads/audio`) — uses OpenAI Whisper or Gemini's audio understanding

**What stays rule-based regardless of provider** (by design, not a gap): duplicate
detection and community-incident clustering use text-similarity + geospatial distance —
this is deterministic, fast, and doesn't require an LLM call per comparison, which is the
right engineering choice for this kind of matching even in a production deployment.

**Voice input note:** the citizen report form's microphone button uses the browser's
built-in `SpeechRecognition` API for instant client-side transcription, so no audio upload
is needed in the common case. The `/api/uploads/audio` endpoint above is the fallback path
for browsers without speech support or for raw audio uploads.

---

## Running tests

```bash
cd CivicAI
pip install -r backend/requirements-dev.txt
pytest tests/ -v
```

**Note on test infrastructure:** no MongoDB server is available in this repo's automated
test environment, so `conftest.py` swaps `pymongo.MongoClient` for `mongomock.MongoClient`
transparently before the app is imported. This only affects `pytest` runs — running the
app normally (`uvicorn` / Docker Compose) always uses real `pymongo` against real MongoDB.

24 tests currently cover: registration/login/RBAC, the full AI pipeline's structured
output, duplicate-detection scoring, resolution-time/escalation-risk prediction, the full
citizen → officer → admin grievance lifecycle (including reopen and invalid-transition
rejection), and the image upload endpoint.

---

## Grievance lifecycle

```
SUBMITTED -> AI_ANALYZED -> DEPARTMENT_ASSIGNED -> OFFICER_ACCEPTED -> IN_PROGRESS
    -> RESOLUTION_SUBMITTED -> CITIZEN_VERIFICATION -> CLOSED
                                    -> REOPENED -> DEPARTMENT_ASSIGNED (re-triage)
(any pre-resolution state) -> ESCALATED
```

Every transition is validated server-side against this state machine (see
`backend/app/models/grievance.py`) and enforced by role — a citizen can't accept a case,
an officer can't close it without the citizen verifying.

## API documentation

Interactive OpenAPI docs are auto-generated by FastAPI at `/docs` (Swagger UI) and
`/redoc` once the backend is running.

## Known limitations / what's simplified for this build

- **Rate limiting** is configured (`RATE_LIMIT_PER_MINUTE` in settings) but not yet
  enforced by middleware — noted here rather than silently omitted.
- **Real-time notifications** are poll-based (the bell polls every 30s), not websockets.
- Duplicate/incident matching uses word-overlap similarity, not embeddings — sufficient
  for the demo dataset but would benefit from a proper embedding model at larger scale.
- Speech-to-text and image captioning are fully wired to OpenAI/Gemini but untested
  against live API calls in this environment (no outbound API key was available here) —
  the mock-mode path for both is tested and verified.

## License

Demo/portfolio project — no license file included; add one before any public release.
