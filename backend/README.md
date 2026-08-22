# CivicAI Nexus — Backend

FastAPI + MongoDB backend for the CivicAI Nexus grievance platform. See the
[root README](../README.md) for full setup, Docker Compose, and AI provider configuration.

## Structure

```
app/
├── ai/           AI provider abstraction (Mock / OpenAI / Gemini) + legacy chat wrapper
├── config/       settings.py, database.py (collections + indexes)
├── models/       Mongo document shape helpers + grievance state machine
├── schemas/      Pydantic request/response schemas
├── routes/       API endpoints, one router per resource
├── services/     business logic (AI pipeline, grievance lifecycle, incidents, predictions...)
├── seed/         seed_data.py — demo data generator
├── utils/        auth dependencies, security (JWT/bcrypt), geo helpers, serialization
└── main.py       app assembly, CORS, error handlers, router registration
```

## Local development

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed.seed_data
uvicorn app.main:app --reload
```

## Tests

Run from the repo root (`CivicAI/`), not this directory — `conftest.py` there sets up the
mongomock bootstrap:

```bash
cd ..
pip install -r backend/requirements-dev.txt
pytest tests/ -v
```
