import os
import re
import logging
from urllib.parse import urlparse, unquote
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
# Workspace .env may exist, but backend/.env is authoritative.
load_dotenv(os.path.join(basedir, "..", ".env"), override=False)
load_dotenv(os.path.join(basedir, ".env"), override=True)

logger = logging.getLogger("counterfactual.database")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

_mongo_client = None
_db_instance = None
_is_connected = False
_connection_error = None


def _strip_wrapping_quotes(value: str) -> str:
    value = (value or "").strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        return value[1:-1].strip()
    return value


def _safe_error_text(exc: Exception) -> str:
    msg = str(exc)
    lowered = msg.lower()
    if "tlsv1_alert_internal_error" in lowered or "ssl handshake failed" in lowered:
        return "TLS handshake to MongoDB Atlas failed (Ensure client IP is whitelisted in Atlas Network Access)"
    if "authentication failed" in lowered or "bad auth" in lowered:
        return "MongoDB authentication failed (Check username and password)"
    msg = re.sub(r"mongodb(?:\+srv)?://[^\s,)]+", "mongodb://***", msg, flags=re.IGNORECASE)
    msg = re.sub(r":([^:@/]+)@", ":****@", msg)
    if len(msg) > 180:
        return msg[:180] + "..."
    return msg


def _uri_diagnostics(raw_uri: str) -> dict:
    info = {
        "configured": bool(raw_uri),
        "username": "",
        "host": "",
        "scheme": "",
    }
    if not raw_uri:
        return info
    try:
        parsed = urlparse(raw_uri)
        info["scheme"] = parsed.scheme or ""
        info["username"] = unquote(parsed.username) if parsed.username else ""
        info["host"] = parsed.hostname or ""
    except Exception:
        match = re.search(r"@([^/?]+)", raw_uri)
        if match:
            info["host"] = match.group(1)
    return info


def get_mongo_client():
    """
    Initializes or returns the active MongoClient connection to MongoDB Atlas.
    The Atlas URI is used as provided — credentials are not decoded/re-encoded.
    """
    global _mongo_client, _connection_error

    if _mongo_client is not None:
        return _mongo_client

    mongodb_uri = _strip_wrapping_quotes(os.getenv("MONGODB_URI", ""))

    if not mongodb_uri:
        _connection_error = "MONGODB_URI environment variable is not configured."
        return None

    try:
        from pymongo import MongoClient
        import certifi

        client_kwargs = {
            "serverSelectionTimeoutMS": 8000,
            "connectTimeoutMS": 8000,
            "socketTimeoutMS": 8000,
            "maxPoolSize": 50,
            "appname": "CounterfactualFintechApp",
            "tlsDisableOCSPEndpointCheck": True,
            "tlsCAFile": certifi.where(),
        }

        client = MongoClient(mongodb_uri, **client_kwargs)
        client.admin.command("ping")
        _mongo_client = client
        _connection_error = None
        return _mongo_client

    except Exception as e:
        _connection_error = _safe_error_text(e)
        logger.error("MongoDB connection attempt failed: %s", _connection_error)
        return None


def _log_startup_diagnostics(connected: bool):
    uri = _strip_wrapping_quotes(os.getenv("MONGODB_URI", ""))
    db_name = os.getenv("MONGODB_DB_NAME", "counterfactual").strip() or "counterfactual"
    info = _uri_diagnostics(uri)

    logger.info("MongoDB configured: %s", "YES" if info["configured"] else "NO")
    if info["host"]:
        logger.info("MongoDB host: %s", info["host"])
    if info["username"]:
        logger.info("MongoDB username: %s", info["username"])
    logger.info("MongoDB database: %s", db_name)
    logger.info("MongoDB connection: %s", "CONNECTED" if connected else "DISCONNECTED")
    if not connected and _connection_error:
        logger.error("MongoDB connection error: %s", _connection_error)


def init_database(strict: bool = False):
    """
    Explicit database startup check.
    Pings MongoDB Atlas and initializes indexes.
    Logs safe status messages without exposing credentials.
    """
    global _db_instance, _is_connected, _connection_error

    db_name = os.getenv("MONGODB_DB_NAME", "counterfactual").strip() or "counterfactual"
    client = get_mongo_client()

    if client is not None:
        try:
            _db_instance = client[db_name]
            _is_connected = True
            _connection_error = None
            _init_db_indexes(_db_instance)
            _log_startup_diagnostics(True)
            return _db_instance
        except Exception as e:
            _is_connected = False
            _connection_error = _safe_error_text(e)
            _log_startup_diagnostics(False)
            if strict:
                raise
    else:
        _is_connected = False
        _log_startup_diagnostics(False)
        if strict and _connection_error:
            raise ConnectionError(f"MongoDB Atlas connection failed: {_connection_error}")

    return None


def get_database():
    """
    Returns the persistent MongoDB Atlas database instance.
    Raises ConnectionError if MongoDB is configured but unreachable.
    There is no JSON or in-memory fallback.
    """
    global _db_instance, _is_connected

    if _db_instance is not None and _is_connected:
        return _db_instance

    db = init_database(strict=False)
    if db is not None:
        return db

    if _connection_error:
        raise ConnectionError(f"MongoDB database unavailable: {_connection_error}")
    raise ConnectionError("MongoDB URI is not configured.")


def _init_db_indexes(db):
    """Ensures unique and query performance indexes on critical collections."""
    try:
        users = db["users"]
        users.create_index([("email", 1)], unique=True)
        users.create_index([("id", 1)])

        simulations = db["counterfactual_simulations"]
        simulations.create_index([("user_id", 1)])
        simulations.create_index([("created_at", -1)])

        audit = db["audit_events"]
        audit.create_index([("user_id", 1)])
        audit.create_index([("timestamp", -1)])

        executions = db["execution_records"]
        executions.create_index([("execution_id", 1)], unique=True)
        executions.create_index([("user_id", 1)])
        executions.create_index([("tenant_id", 1)])
        executions.create_index([("status", 1)])
        executions.create_index([("requested_at", -1)])
        executions.create_index([("idempotency_key", 1)])

        outcomes = db["outcome_records"]
        outcomes.create_index([("outcome_id", 1)], unique=True)
        outcomes.create_index([("user_id", 1)])
        outcomes.create_index([("tenant_id", 1)])
        outcomes.create_index([("transaction_id", 1)])
        outcomes.create_index([("execution_id", 1)])
        outcomes.create_index([("simulation_id", 1)])
        outcomes.create_index([("comparison.severity", 1)])
        outcomes.create_index([("created_at", -1)])

        rag_chunks = db["rag_knowledge_chunks"]
        rag_chunks.create_index([("chunk_id", 1)], unique=True)
        rag_chunks.create_index([("document_id", 1)])
        rag_chunks.create_index([("tenant_id", 1)])
        rag_chunks.create_index([("source_type", 1)])
        rag_chunks.create_index([("metadata.category", 1)])
        rag_chunks.create_index([("created_at", -1)])

        imported_txns = db["tenant_imported_transactions"]
        imported_txns.create_index([("transaction_id", 1), ("user_id", 1)], unique=True)
        imported_txns.create_index([("user_id", 1)])
        imported_txns.create_index([("tenant_id", 1)])
        imported_txns.create_index([("status", 1)])
        imported_txns.create_index([("imported_at", -1)])
    except Exception as e:
        logger.warning("Index initialization warning: %s", _safe_error_text(e))


def get_users_collection():
    db = get_database()
    return db["users"]


def get_simulations_collection():
    db = get_database()
    return db["counterfactual_simulations"]


def get_audit_events_collection():
    db = get_database()
    return db["audit_events"]


def get_executions_collection():
    db = get_database()
    return db["execution_records"]


def get_outcomes_collection():
    db = get_database()
    return db["outcome_records"]


def get_rag_chunks_collection():
    db = get_database()
    return db["rag_knowledge_chunks"]


def is_mongodb_live() -> bool:
    global _is_connected, _connection_error
    try:
        client = get_mongo_client()
        if client is None:
            _is_connected = False
            return False
        client.admin.command("ping")
        _is_connected = True
        return True
    except Exception as e:
        _is_connected = False
        _connection_error = _safe_error_text(e)
        return False


def get_mongodb_error() -> str | None:
    return _connection_error


def reset_database_connection():
    global _mongo_client, _db_instance, _is_connected, _connection_error
    if _mongo_client:
        try:
            _mongo_client.close()
        except Exception:
            pass
    _mongo_client = None
    _db_instance = None
    _is_connected = False
    _connection_error = None
