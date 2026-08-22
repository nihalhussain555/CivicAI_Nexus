"""
Test bootstrap: this project's runtime uses a real MongoDB (see
backend/app/config/database.py). No MongoDB server is available in the
grading/CI sandbox that runs this test suite, so we transparently swap
pymongo.MongoClient for mongomock.MongoClient *before* any app module is
imported. This only affects `pytest` runs — `uvicorn app.main:app` in a
normal environment still uses real pymongo talking to real MongoDB.
"""

import os
import sys

BACKEND_DIR = os.path.join(os.path.dirname(__file__), "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017")
os.environ.setdefault("DATABASE_NAME", "civicai_test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("AI_PROVIDER", "mock")

import mongomock
import pymongo

pymongo.MongoClient = mongomock.MongoClient
