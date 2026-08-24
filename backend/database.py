import os
import re
import urllib.parse
import logging
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv

# Search and load .env from backend directory or workspace root
basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'), override=True)
load_dotenv(os.path.join(basedir, '..', '.env'), override=True)

logger = logging.getLogger("counterfactual.database")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

_mongo_client = None
_db_instance = None
_is_connected = False
_connection_error = None


def sanitize_mongodb_uri(raw_uri: str) -> str:
    """
    Safely ensures that user and password components in a mongodb/mongodb+srv URI
    are properly URL-encoded if they contain special characters.
    """
    if not raw_uri:
        return raw_uri
    
    # Match standard mongodb or mongodb+srv connection string
    pattern = r'^(mongodb(?:\+srv)?://)([^:]+):(.+)@([^/?]+)(.*)$'
    match = re.match(pattern, raw_uri)
    if match:
        prefix, user, pwd, host, rest = match.groups()
        # Decode first if already partially encoded, then quote_plus
        decoded_user = urllib.parse.unquote_plus(user)
        decoded_pwd = urllib.parse.unquote_plus(pwd)
        encoded_user = urllib.parse.quote_plus(decoded_user)
        encoded_pwd = urllib.parse.quote_plus(decoded_pwd)
        return f"{prefix}{encoded_user}:{encoded_pwd}@{host}{rest}"
    return raw_uri


def get_mongo_client():
    """
    Initializes or returns the active MongoClient connection to MongoDB Atlas.
    """
    global _mongo_client, _connection_error

    if _mongo_client is not None:
        return _mongo_client

    mongodb_uri = os.getenv("MONGODB_URI", "").strip()

    if not mongodb_uri:
        _connection_error = "MONGODB_URI environment variable is not configured."
        return None

    sanitized_uri = sanitize_mongodb_uri(mongodb_uri)

    try:
        from pymongo import MongoClient

        client_kwargs = {
            "serverSelectionTimeoutMS": 4000,
            "connectTimeoutMS": 4000,
            "socketTimeoutMS": 5000,
            "maxPoolSize": 50,
            "appname": "CounterfactualFintechApp",
        }

        try:
            import certifi
            client_kwargs["tlsCAFile"] = certifi.where()
        except ImportError:
            pass

        client = MongoClient(sanitized_uri, **client_kwargs)
        # Test connection with ping
        client.admin.command("ping")
        _mongo_client = client
        _connection_error = None
        return _mongo_client

    except Exception as e:
        _connection_error = str(e)
        logger.error(f"MongoDB connection attempt failed: {str(e)}")
        return None


def init_database(strict: bool = False):
    """
    Explicit database startup check.
    Pings MongoDB Atlas and initializes indexes.
    Logs safe status messages without exposing credentials.
    """
    global _db_instance, _is_connected, _connection_error

    db_name = os.getenv("MONGODB_DB_NAME", "counterfactual").strip()
    client = get_mongo_client()

    if client is not None:
        try:
            _db_instance = client[db_name]
            _is_connected = True
            _connection_error = None
            _init_db_indexes(_db_instance)
            logger.info("MongoDB Atlas connected successfully")
            logger.info(f"Database: {db_name}")
            return _db_instance
        except Exception as e:
            _is_connected = False
            _connection_error = str(e)
            logger.error(f"MongoDB Atlas initialization failed: {str(e)}")
            if strict:
                raise e
    else:
        _is_connected = False
        logger.warning("MongoDB Atlas is not connected. Operational queries will fail.")
        if strict and _connection_error:
            raise ConnectionError(f"MongoDB Atlas connection failed: {_connection_error}")

    return None


def get_database():
    """
    Returns the persistent MongoDB Atlas database instance.
    Raises ConnectionError if MongoDB is configured but unreachable.
    """
    global _db_instance, _is_connected, _connection_error

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
    except Exception as e:
        logger.warning(f"Index initialization warning: {e}")


def get_users_collection():
    db = get_database()
    return db["users"]


def get_simulations_collection():
    db = get_database()
    return db["counterfactual_simulations"]


def get_audit_events_collection():
    db = get_database()
    return db["audit_events"]


def is_mongodb_live() -> bool:
    global _is_connected
    if not _is_connected:
        try:
            init_database(strict=False)
        except Exception:
            pass
    return _is_connected


def get_mongodb_error() -> str | None:
    global _connection_error
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
