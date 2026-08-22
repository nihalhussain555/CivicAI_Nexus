from app.config.database import users_collection
from app.models.user import user_document
from app.utils.security import hash_password, verify_password


def register_user(name, email, password, language="English", phone=None):
    email = email.lower().strip()

    existing = users_collection.find_one({"email": email})
    if existing:
        raise ValueError("Email is already registered")

    password_hash = hash_password(password)

    user = user_document(
        name=name, email=email, password_hash=password_hash, role="citizen", phone=phone,
    )
    user["language"] = language

    result = users_collection.insert_one(user)
    return str(result.inserted_id)


def authenticate(email, password):
    email = email.lower().strip()

    user = users_collection.find_one({"email": email})
    if not user:
        return None

    if not verify_password(password, user["password_hash"]):
        return None

    return user
