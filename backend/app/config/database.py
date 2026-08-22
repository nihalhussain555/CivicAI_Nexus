from pymongo import MongoClient, ASCENDING, DESCENDING, GEOSPHERE, TEXT
from pymongo.errors import PyMongoError

from app.config.settings import settings


client = MongoClient(
    settings.MONGO_URI,
    serverSelectionTimeoutMS=5000
)

db = client[settings.DATABASE_NAME]


# --- Collections ---
users_collection = db["users"]
grievances_collection = db["grievances"]
incidents_collection = db["incidents"]
departments_collection = db["departments"]
notifications_collection = db["notifications"]
audit_logs_collection = db["audit_logs"]

# Backward-compatible alias (older modules referred to "complaints")
complaints_collection = grievances_collection


def check_database_connection():
    try:
        client.admin.command("ping")
        return True
    except PyMongoError:
        return False


def create_indexes():
    try:
        users_collection.create_index("email", unique=True)
        users_collection.create_index("role")
        users_collection.create_index("department")

        grievances_collection.create_index("grievance_id", unique=True)
        grievances_collection.create_index("citizen_id")
        grievances_collection.create_index("status")
        grievances_collection.create_index("department")
        grievances_collection.create_index("assigned_officer")
        grievances_collection.create_index("category")
        grievances_collection.create_index("priority")
        grievances_collection.create_index("incident_id")
        grievances_collection.create_index("created_at")
        grievances_collection.create_index([("location", GEOSPHERE)])
        grievances_collection.create_index(
            [("title", TEXT), ("description", TEXT), ("translated_text", TEXT)]
        )

        incidents_collection.create_index("status")
        incidents_collection.create_index("category")
        incidents_collection.create_index("created_at")
        incidents_collection.create_index([("center", GEOSPHERE)])

        departments_collection.create_index("code", unique=True)

        notifications_collection.create_index("user_id")
        notifications_collection.create_index([("user_id", ASCENDING), ("read", ASCENDING)])
        notifications_collection.create_index("created_at")

        audit_logs_collection.create_index("actor_id")
        audit_logs_collection.create_index("entity_id")
        audit_logs_collection.create_index("created_at")

    except PyMongoError as error:
        print(f"WARNING: index creation failed: {error}")
