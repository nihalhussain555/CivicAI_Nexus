# CivicAI Nexus

**Predictive Multimodal Grievance Intelligence & Resolution Platform**

Citizens report public problems via text, voice, image, and location. AI classifies, prioritizes, and routes every report to the correct department, detects duplicate and community-wide incidents, assists officers with an AI Copilot, predicts resolution time and SLA/escalation risk, and tracks each case through to citizen verification. Citizens are rewarded for meaningful civic participation through points, achievement badges, and verified digital certificates for activities such as reporting issues, identifying community-wide problems, and contributing to successful resolutions.

---

## Stack

| Layer     | Tech                                                                 |
|-----------|-----------------------------------------------------------------------|
| Frontend  | React + Vite, React Router, Axios, Lucide React, Framer Motion, Recharts, React Leaflet |
| Backend   | FastAPI (Python)                                                     |
| Database  | MongoDB (with geospatial + text indexes)                             |
| Auth      | JWT + bcrypt + role-based access control                             |
| AI        | Provider-independent abstraction — MockAIProvider (offline demo) or OpenAI / Gemini / Groq, with automatic per-call fallback to mock |

---

## Repository layout

```
CivicAI/
├── backend/          FastAPI app, AI pipeline, seed script, tests support
├── frontend/          React + Vite app
├── tests/              pytest suite (backend)
├── conftest.py         test bootstrap (see "Running tests" below)
└── knowledge_base/     FAQ content used by the AI assistant's retrieval
```

---

## Quick start

Demo accounts (password for all: `Demo@123`):

| Role     | Email               |
|----------|---------------------|
| Citizen  | citizen@demo.com    |
| Officer  | officer@demo.com    |
| Admin    | admin@demo.com      |
| District admin | chennai.admin@demo.com |

`admin@demo.com` has no district, which the backend treats as an unrestricted
"super admin"; the district admin can only create officers inside Chennai. Both
are seeded so the difference is visible without editing data.

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
python run.py     # http://localhost:8000
```

Requires a running MongoDB instance (local install, or Atlas) — set `MONGO_URI`
in `.env` accordingly.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env               
npm run dev                        # http://localhost:5173
```

---

## AI provider configuration

The platform works fully **offline** with `AI_PROVIDER=mock` (the default) — no API key
required, and every prediction is deterministic so the whole citizen → officer → admin
workflow runs end to end for demos and grading.

To use a real LLM instead, set in `backend/.env`:

```env
AI_PROVIDER=groq
GROQ_API_KEY=...
GROQ_MODEL=openai/gpt-oss-20b      # default if unset
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

30 tests currently cover: registration/OTP/login/RBAC, the full AI pipeline's structured
output, duplicate-detection scoring, resolution-time/escalation-risk prediction, the full
citizen → officer → admin grievance lifecycle (including reopen and invalid-transition
rejection), and the image upload endpoint.

`conftest.py` also pins `AI_PROVIDER=mock` and `EMAIL_PROVIDER=mock`, so a test run never
makes an outbound model call or sends real mail; both are overridden only if you set them
yourself in the environment.

---

## Grievance lifecycle

```
SUBMITTED -> AI_ANALYZED -> DEPARTMENT_ASSIGNED -> OFFICER_ACCEPTED -> IN_PROGRESS-> RESOLUTION_SUBMITTED -> CITIZEN_VERIFICATION -> CLOSED
                                                                                   -> REOPENED -> DEPARTMENT_ASSIGNED (re-triage)
(any pre-resolution state) -> ESCALATED
```

Every transition is validated server-side against this state machine (see
`backend/app/models/grievance.py`) and enforced by role — a citizen can't accept a case,
an officer can't close it without the citizen verifying.

---

## Finding fake grievances

A fabricated report costs a field crew an afternoon and a ward its credibility, so the
platform scores every submission for authenticity the moment it is created. The whole
engine lives in `backend/app/services/authenticity_service.py` (the report) and
`backend/app/services/trust_service.py` (the account behind it).

**The one rule that shapes everything else: scoring never rejects a report.** A
false positive on a real emergency is worse to a citizen than a false positive on a
fake one is to the department. Detection produces a score, an explanation, and a place
in a human's queue. Only a staff member ever marks a report false, and the citizen can
appeal that.

### How a report is scored

Every submission starts at 70 and each signal that fires adds or subtracts a fixed
weight. The result lands in a verdict band:

| Band | Score | Meaning |
|------|-------|---------|
| `LIKELY_GENUINE` | ≥ 65 | flows to the normal department queue |
| `NEEDS_REVIEW` | 40–64 | held for the Integrity Review queue |
| `LIKELY_FAKE` | < 40 | queued, and its reward points are held until a human decides |

One more rule decides who gets read: **a single signal at −25 or worse queues the case
whatever its total** (`REVIEW_SIGNAL_FLOOR`). The total is a weighted blend, so a
confidently written lie with a real street, a duration and a borrowed photo can sum its
way above 65 — and it should still be looked at. The verdict band drives points; this
floor only drives attention.

### The signals

| Family | Fires on | Weight |
|--------|----------|--------|
| Text quality | `test`-type entries (−35), keyboard mashing (−25), mostly symbols (−25), vowelless words (−20), spam markers/links (−20), repetitive text (−15), long character runs (−15), too short to act on (−15), all caps (−5) | negative |
| Specificity | detailed description (+8), names a street/landmark (+7), gives a duration or number (+5) | positive |
| Location | coordinates are exactly (0,0) (−40), outside the service area (−30), no coordinates at all (−20), no address text (−5) | negative |
| Evidence | photo attached (+10); the same image bytes already filed by another account on a *different* kind of problem (−28), same kind and area (−8), reused by the same account (−12) | both |
| Behaviour | burst of reports in an hour (−25), high 24h volume (−15), account under a day old (−10 / −5) | negative |
| Corroboration | other citizens reported the same category nearby in 14 days (+6, +12 for several) | positive |
| Collusion | identical wording from ≥3 unrelated accounts within 30 days: across 2+ districts it reads as a broadcast campaign (−20 to −32, scaling with accounts); confined to one area it reads as one real problem being forwarded around (−6) | negative |
| Account trust | low-trust account (−12 / −20), an earlier report staff already marked false (−8); trusted account (+10), verified history (+6) | both |
| Consistency | demands HIGH/CRITICAL urgency but names no place, landmark or duration (−15); repeats the account's own earlier report (−10) | negative |

The collusion weights are the reason two similar-looking situations are scored
differently: twenty households on one street sending one photo of one open drain is a
community problem with a template body, while the same body arriving from several
districts is a coordinated broadcast. Only the second is penalised.

### The AI as a second estimator

When a real provider is configured, the same text is also read by the LLM
(`AUTHENTICITY_LLM_FUSION`, `AUTHENTICITY_LLM_WEIGHT=0.35`). The merge is deliberately
asymmetric:

- The AI is never the only reason a report is called fake. A fluent fabrication can
  persuade a language model; the rules hold the facts the model cannot see — GPS,
  history, photo reuse. If the rules did not reach the fake band, the fused score is
  floored just inside `NEEDS_REVIEW`.
- The AI is never the only reason a report is cleared. If the rules put it in the fake
  band, the AI can downgrade it for human eyes but cannot promote it back out.
- A large gap between the two estimators is recorded as
  `estimator_disagreement` and charted on the admin dashboard. That gap is where a
  human adds the most value, and a low agreement rate is a reason to retune the
  weights — not a reason to flag more reports.

### The account behind the report

`trust_service.py` scores the *citizen*, derived only from events the platform has
already recorded (verified resolutions, staff-substantiated flags, withdrawals,
self-duplicates, appeals upheld), never from anything the user declares:

| Level | Reached at | Friction |
|-------|-----------|----------|
| `STANDARD` | default | none |
| `WATCH` | 1 substantiated flag | the flag rides along on every later report as a −8 caution |
| `STRICT` | 2 (`TRUST_STRICT_FLAG_THRESHOLD`) | 5/day cap, points held until an officer reviews, photo expected |
| `SEVERE` | 4 (`TRUST_SEVERE_FLAG_THRESHOLD`) | 2/day cap, every report goes staff-first |

The caps are the only hard stop anywhere in this feature, and they limit *volume from an
account with a substantiated record*, not the content of a report. Citizens see their
appeals and outcomes, never their own score — publishing the formula would just teach
people which signals to route around.

### What staff and citizens see

- **Integrity Review queue** (`/officer/integrity`, `/admin/integrity`) — cases sorted
  by score, worst first, each with its signal breakdown. Triage either way: *flag as
  false* (reason required, points reversed, citizen notified) or *confirm genuine*
  (releases held points). A human decision always outranks the score and is kept
  alongside it for the audit trail.
- **Grievance detail** — the `AuthenticityCard` explains the score in plain language;
  an appeal waiting for review moves to the queue's *Appeals* tab.
- **Citizen side** — a flagged case shows why, and an *Appeal this decision* button
  (max 2 appeals per case, `MAX_FLAG_APPEALS` in `backend/app/models/grievance.py`).
  An upheld appeal unflags the case, restores the points, and raises the account's
  trust again.
- **Fraud & Integrity dashboard** (`/admin/fraud`) — verdict mix, likely-fake trend per
  day, the signals that fired most, adjudication outcomes, appeals, and how often the
  rules and the AI disagreed.

### API surface

All staff-only except the appeal request; the analytics endpoint is admin-only.

```
GET  /api/grievances/integrity/queue          # ?only_appeals=true&verdict=&district=&search=
PUT  /api/grievances/{id}/integrity/triage    # {decision: GENUINE|FAKE, note}
PUT  /api/grievances/{id}/unflag              # reverse a false-report flag, note required
POST /api/grievances/{id}/flag-appeal         # citizen contests a flag, reason required
PUT  /api/grievances/{id}/flag-appeal/review  # {approve, note}
GET  /api/analytics/admin/integrity           # ?days=30
```

`authenticity`, `needs_authenticity_review`, `content_fingerprint` and `integrity` are
listed in `STAFF_ONLY_FIELDS` (`backend/app/models/grievance.py`) and are stripped from
every citizen-facing payload.

### Seeing it work

The seed ships nine reports built to trip specific detectors (junk text, a spam link,
(0,0) coordinates, a three-account two-district campaign, a photo recycled across
different problems, and an urgent report with nothing actionable in it), plus one full
appeal cycle already on record. Run `python -m app.seed.seed_data` and open the
Integrity Review queue as `officer@demo.com`.

### Deliberate limits

- Photo matching is **exact-content** (SHA-256 of the stored bytes), not perceptual: it
  catches the forwarded-same-image case and needs no image library, but a crop or
  re-encode slips through. Perceptual hashing is the upgrade path.
- Fingerprints hash a *sorted token set*, so two genuinely different complaints that
  happen to share their whole vocabulary can collide. The consequence is that a human
  looks at both.
- Corroboration and reuse lookups are geospatial/text queries over the last 30–180 days
  (`COLLUSION_WINDOW_DAYS`, `EVIDENCE_REUSE_WINDOW_DAYS`); older history is invisible by
  design, since an image archive from years ago is weak evidence about today.
- Weights are hand-tuned, not learned. No labelled corpus of fake civic reports exists
  for this dataset, so the tuning is honest-but-judgemental, which is exactly why the
  dashboard shows agreement rates and every automated decision is reviewable.

---

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
