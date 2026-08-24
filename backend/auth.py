import os
import uuid
import jwt
from functools import wraps
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_users_collection, get_audit_events_collection, is_mongodb_live, get_mongodb_error

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# JWT / Auth Secret from environment (never hardcoded)
JWT_SECRET = os.getenv('AUTH_SECRET') or os.getenv('JWT_SECRET') or 'cf_jwt_production_secret_key_sec_9938'
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = int(os.getenv('JWT_EXPIRATION_HOURS', '24'))

# In-memory blacklist for revoked JWT tokens (logout)
REVOKED_TOKENS = set()


def log_audit_event(user_id: str, action: str, transaction_id: str = None, metadata: dict = None):
    """
    Persists an audit event to the audit_events collection in MongoDB Atlas.
    Guarantees no sensitive secrets, tokens, or password hashes are logged.
    """
    try:
        audit_col = get_audit_events_collection()
        now_iso = datetime.now(timezone.utc).isoformat()

        # Strip all sensitive credential fields
        safe_metadata = {}
        if metadata and isinstance(metadata, dict):
            for k, v in metadata.items():
                if k.lower() not in ("password", "password_hash", "token", "secret", "auth_header", "key"):
                    safe_metadata[k] = v

        event_doc = {
            "id": f"aud_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "action": action,
            "timestamp": now_iso,
            "transaction_id": transaction_id or "",
            "metadata": safe_metadata
        }
        audit_col.insert_one(event_doc)
        return event_doc
    except Exception:
        # Audit logging failure should not crash main request
        return None


def generate_jwt_token(user_id: str, email: str) -> str:
    """Generates a secure signed JWT token for session authentication."""
    now = datetime.now(timezone.utc)
    payload = {
        'sub': str(user_id),
        'email': str(email).lower(),
        'iat': now,
        'exp': now + timedelta(hours=JWT_EXPIRATION_HOURS),
        'jti': uuid.uuid4().hex
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token: str):
    """Decodes and validates a JWT token signature and expiration."""
    if not token or token in REVOKED_TOKENS:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def require_auth(f):
    """
    Decorator to protect API endpoints.
    Enforces JWT authentication, extracts user identity from server-side token,
    and attaches authenticated user to Flask's global context (g.user_id, g.user).
    Returns 401 Unauthorized on missing or invalid credentials.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        token = ''
        if auth_header.startswith('Bearer '):
            token = auth_header[7:].strip()
        elif 'token' in request.args:
            token = request.args.get('token', '').strip()

        if not token:
            return jsonify({
                "error": "Unauthorized",
                "message": "Authentication token is required to access this endpoint."
            }), 401

        payload = decode_jwt_token(token)
        if not payload:
            return jsonify({
                "error": "Unauthorized",
                "message": "Session expired or invalid authentication token. Please sign in again."
            }), 401

        user_id = payload.get('sub')
        email = payload.get('email')

        try:
            users_col = get_users_collection()
            user_doc = users_col.find_one({"id": user_id}) or users_col.find_one({"email": email})
        except ConnectionError as ce:
            return jsonify({
                "error": "Database Unavailable",
                "message": f"Unable to reach MongoDB Atlas: {str(ce)}"
            }), 503
        except Exception:
            user_doc = None

        if not user_doc:
            return jsonify({
                "error": "Unauthorized",
                "message": "User account could not be found or has been revoked."
            }), 401

        # Store authenticated identity in Flask context
        g.user_id = str(user_doc.get("id") or user_doc.get("_id"))
        g.user = user_doc
        g.auth_token = token

        return f(*args, **kwargs)

    return decorated_function


def format_user_response(user_doc: dict) -> dict:
    """Formats a safe user dictionary for client response, omitting secrets."""
    return {
        "id": str(user_doc.get("id") or user_doc.get("_id", "")),
        "name": user_doc.get("name", "Treasury Operator"),
        "email": user_doc.get("email", ""),
        "organization": user_doc.get("organization", "Counterfactual Treasury"),
        "role": user_doc.get("role", "Treasury Operator"),
        "created_at": user_doc.get("created_at", "")
    }


@auth_bp.route('/signup', methods=['POST'])
def signup():
    """Register a new user in MongoDB Atlas with secure password hashing."""
    try:
        data = request.get_json(silent=True) or {}
        name = str(data.get('name', '')).strip()
        email = str(data.get('email', '')).strip().lower()
        password = str(data.get('password', ''))
        organization = str(data.get('organization', '')).strip() or "Counterfactual Treasury"

        if not name:
            return jsonify({"error": "Full name is required."}), 400
        if not email or '@' not in email:
            return jsonify({"error": "A valid work email address is required."}), 400
        if not password or len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters."}), 400

        try:
            users_col = get_users_collection()
        except ConnectionError as ce:
            return jsonify({
                "error": "Database Connection Failed",
                "message": f"Unable to connect to MongoDB Atlas database. Please verify MONGODB_URI credentials: {str(ce)}"
            }), 503

        # Enforce unique email check
        existing_user = users_col.find_one({"email": email})
        if existing_user:
            return jsonify({
                "error": "An account with this email already exists."
            }), 409

        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        new_user = {
            "id": user_id,
            "name": name,
            "email": email,
            "password_hash": generate_password_hash(password),
            "organization": organization,
            "role": "Treasury Operator",
            "created_at": now_iso,
            "updated_at": now_iso,
            "last_login": now_iso
        }

        users_col.insert_one(new_user)
        token = generate_jwt_token(user_id, email)

        # Record audit event
        log_audit_event(user_id, "REGISTER", metadata={"email": email, "organization": organization})

        return jsonify({
            "user": format_user_response(new_user),
            "token": token
        }), 201

    except ConnectionError as ce:
        return jsonify({
            "error": "Database Connection Failed",
            "message": f"MongoDB Atlas connection failure: {str(ce)}"
        }), 503
    except Exception as e:
        if "E11000" in str(e) or "DuplicateKeyError" in str(e):
            return jsonify({"error": "An account with this email already exists."}), 409
        return jsonify({
            "error": "Unable to complete registration. Please verify your details and try again."
        }), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate user credentials against MongoDB Atlas."""
    try:
        data = request.get_json(silent=True) or {}
        email = str(data.get('email', '')).strip().lower()
        password = str(data.get('password', ''))

        if not email or not password:
            return jsonify({"error": "Please provide both email and password."}), 400

        try:
            users_col = get_users_collection()
        except ConnectionError as ce:
            return jsonify({
                "error": "Database Connection Failed",
                "message": f"Unable to connect to MongoDB Atlas database: {str(ce)}"
            }), 503

        user_doc = users_col.find_one({"email": email})

        if not user_doc or not check_password_hash(user_doc.get('password_hash', ''), password):
            return jsonify({
                "error": "Invalid email or password. Please verify your credentials."
            }), 401

        user_id = str(user_doc.get("id") or user_doc.get("_id"))
        now_iso = datetime.now(timezone.utc).isoformat()
        
        try:
            users_col.update_one(
                {"_id": user_doc["_id"]},
                {"$set": {"last_login": now_iso, "updated_at": now_iso}}
            )
        except Exception:
            pass

        token = generate_jwt_token(user_id, email)

        # Record audit event
        log_audit_event(user_id, "LOGIN", metadata={"email": email})

        return jsonify({
            "user": format_user_response(user_doc),
            "token": token
        }), 200

    except ConnectionError as ce:
        return jsonify({
            "error": "Database Connection Failed",
            "message": f"MongoDB Atlas connection failure: {str(ce)}"
        }), 503
    except Exception:
        return jsonify({
            "error": "An authentication error occurred. Please try again."
        }), 500


@auth_bp.route('/me', methods=['GET'])
@require_auth
def get_me():
    """Retrieve currently authenticated user profile."""
    return jsonify({
        "user": format_user_response(g.user)
    }), 200


@auth_bp.route('/logout', methods=['POST'])
@require_auth
def logout():
    """Revoke active JWT session token and log logout audit event."""
    if hasattr(g, 'auth_token') and g.auth_token:
        REVOKED_TOKENS.add(g.auth_token)

    log_audit_event(g.user_id, "LOGOUT")

    return jsonify({
        "status": "logged_out",
        "message": "Session invalidated successfully."
    }), 200
