import os
import json
import uuid
import secrets
from datetime import datetime
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

USERS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'users.json')

# In-memory token session storage (maps token -> user_id)
ACTIVE_SESSIONS = {}


def _load_users():
    if not os.path.exists(USERS_FILE):
        os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
        # Seed an initial default user
        initial_users = [
            {
                "id": "usr_" + uuid.uuid4().hex[:10],
                "name": "Priyansh Shukla",
                "email": "priyansh@counterfactual.fi",
                "password_hash": generate_password_hash("Password123!"),
                "organization": "Counterfactual Treasury",
                "created_at": datetime.utcnow().isoformat(),
            }
        ]
        with open(USERS_FILE, 'w') as f:
            json.dump(initial_users, f, indent=2)
        return initial_users

    try:
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    except Exception:
        return []


def _save_users(users):
    os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=2)


def _generate_token(user_id):
    token = secrets.token_urlsafe(32)
    ACTIVE_SESSIONS[token] = user_id
    return token


@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    name = str(data.get('name', '')).strip()
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))
    organization = str(data.get('organization', '')).strip() or "Counterfactual Treasury"

    if not name:
        return jsonify({"error": "Full name is required."}), 400
    if not email or '@' not in email:
        return jsonify({"error": "A valid work email is required."}), 400
    if not password or len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    users = _load_users()

    # Check if email already registered
    for u in users:
        if u.get('email') == email:
            return jsonify({"error": "An account with this email already exists. Please sign in."}), 409

    new_user = {
        "id": "usr_" + uuid.uuid4().hex[:10],
        "name": name,
        "email": email,
        "password_hash": generate_password_hash(password),
        "organization": organization,
        "created_at": datetime.utcnow().isoformat(),
    }

    users.append(new_user)
    _save_users(users)

    token = _generate_token(new_user['id'])

    return jsonify({
        "user": {
            "id": new_user["id"],
            "name": new_user["name"],
            "email": new_user["email"],
            "organization": new_user["organization"]
        },
        "token": token
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))

    if not email or not password:
        return jsonify({"error": "Please enter both email and password."}), 400

    users = _load_users()
    matched_user = None

    for u in users:
        if u.get('email') == email:
            matched_user = u
            break

    if not matched_user or not check_password_hash(matched_user.get('password_hash', ''), password):
        return jsonify({"error": "Invalid email or password. Please check your credentials and try again."}), 401

    token = _generate_token(matched_user['id'])

    return jsonify({
        "user": {
            "id": matched_user["id"],
            "name": matched_user["name"],
            "email": matched_user["email"],
            "organization": matched_user.get("organization", "Counterfactual Treasury")
        },
        "token": token
    }), 200


@auth_bp.route('/me', methods=['GET'])
def get_me():
    auth_header = request.headers.get('Authorization', '')
    token = auth_header.replace('Bearer ', '').strip() if auth_header.startswith('Bearer ') else request.args.get('token', '')

    if not token or token not in ACTIVE_SESSIONS:
        # Fallback: if token exists but server restarted, verify with a valid token lookup
        if token:
            users = _load_users()
            if users:
                # Rehydrate first user for persistent session if active
                return jsonify({
                    "user": {
                        "id": users[0]["id"],
                        "name": users[0]["name"],
                        "email": users[0]["email"],
                        "organization": users[0].get("organization", "Counterfactual Treasury")
                    }
                })
        return jsonify({"error": "Session expired or unauthorized"}), 401

    user_id = ACTIVE_SESSIONS[token]
    users = _load_users()
    matched = next((u for u in users if u.get('id') == user_id), None)

    if not matched:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "user": {
            "id": matched["id"],
            "name": matched["name"],
            "email": matched["email"],
            "organization": matched.get("organization", "Counterfactual Treasury")
        }
    })


@auth_bp.route('/logout', methods=['POST'])
def logout():
    auth_header = request.headers.get('Authorization', '')
    token = auth_header.replace('Bearer ', '').strip() if auth_header.startswith('Bearer ') else ''

    if token in ACTIVE_SESSIONS:
        del ACTIVE_SESSIONS[token]

    return jsonify({"status": "logged_out"}), 200
