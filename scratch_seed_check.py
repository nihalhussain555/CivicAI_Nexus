"""Throwaway check: runs the seeder against mongomock and prints what the
integrity surfaces would show. Delete after use."""

import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "backend"))

os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017")
os.environ.setdefault("DATABASE_NAME", "civicai_seedcheck")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("AI_PROVIDER", "mock")

import mongomock
import pymongo

pymongo.MongoClient = mongomock.MongoClient

from app.seed import seed_data  # noqa: E402
from app.config.database import grievances_collection, users_collection  # noqa: E402

seed_data.run()

rows = list(grievances_collection.find({}))
print(f"\ntotal grievances: {len(rows)}")

verdicts = {}
for row in rows:
    verdict = (row.get("authenticity") or {}).get("verdict", "UNSCORED")
    verdicts[verdict] = verdicts.get(verdict, 0) + 1
print("verdicts:", verdicts)

print("needs_authenticity_review:", sum(1 for r in rows if r.get("needs_authenticity_review")))
print("flagged_invalid:", sum(1 for r in rows if r.get("flagged_invalid")))
print("pending appeals:", sum(1 for r in rows if r.get("flag_appeal_status") == "PENDING"))
print("human decisions:", sum(1 for r in rows if (r.get("integrity") or {}).get("human_decision")))
print("with fingerprints:", sum(1 for r in rows if r.get("content_fingerprint")))
print("with trust on user:", sum(1 for u in users_collection.find({}) if u.get("trust")))

print("\nthe suspect cases:")
for row in rows:
    authenticity = row.get("authenticity") or {}
    if not authenticity.get("signals"):
        continue
    negatives = [s for s in authenticity["signals"] if s["impact"] < 0]
    if not negatives:
        continue
    print(f"  {row['grievance_id']} {authenticity.get('score')}/100 {authenticity.get('verdict')}"
          f"  [{'/'.join(s['signal'] for s in negatives)}]  "
          f"review={bool(row.get('needs_authenticity_review'))}")

print("\nqueue order (what Integrity Review shows):")
for row in sorted(rows, key=lambda r: (r.get("authenticity") or {}).get("score", 100)):
    if not row.get("needs_authenticity_review"):
        continue
    authenticity = row.get("authenticity") or {}
    print(f"  {authenticity.get('score')}/100 {row['grievance_id']} {row['title'][:46]!r}")
