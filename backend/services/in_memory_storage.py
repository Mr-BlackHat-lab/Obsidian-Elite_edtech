"""In-memory storage for sessions when MongoDB is not available."""
import datetime
from typing import Any

# In-memory storage
_sessions: dict[str, dict[str, Any]] = {}


class InMemoryDB:
    """Simple in-memory database replacement for MongoDB."""
    
    def __init__(self):
        self.sessions = InMemorySessionCollection()
        self.users = InMemoryUserCollection()


class InMemorySessionCollection:
    """In-memory session collection."""
    
    async def find_one(self, query: dict, **kwargs) -> dict | None:
        """Find one session matching query."""
        for session in _sessions.values():
            if self._matches(session, query):
                return session
        return None
    
    async def insert_one(self, document: dict) -> None:
        """Insert a session."""
        session_id = document.get("session_id")
        if session_id:
            _sessions[session_id] = document
    
    async def update_one(self, query: dict, update: dict, **kwargs) -> None:
        """Update a session."""
        for session_id, session in _sessions.items():
            if self._matches(session, query):
                if "$set" in update:
                    session.update(update["$set"])
                if "$setOnInsert" in update and kwargs.get("upsert"):
                    for key, value in update["$setOnInsert"].items():
                        if key not in session:
                            session[key] = value
                return
        
        # Upsert: create new if not found
        if kwargs.get("upsert"):
            new_doc = {}
            if "$setOnInsert" in update:
                new_doc.update(update["$setOnInsert"])
            if "$set" in update:
                new_doc.update(update["$set"])
            session_id = query.get("session_id") or new_doc.get("session_id")
            if session_id:
                _sessions[session_id] = new_doc
    
    async def create_index(self, field: str, **kwargs) -> None:
        """No-op for in-memory storage."""
        pass
    
    def _matches(self, document: dict, query: dict) -> bool:
        """Check if document matches query."""
        for key, value in query.items():
            if key == "$in":
                continue
            if isinstance(value, dict):
                if "$in" in value:
                    if document.get(key) not in value["$in"]:
                        return False
                continue
            if document.get(key) != value:
                return False
        return True


class InMemoryUserCollection:
    """In-memory user collection."""
    
    async def create_index(self, field: str, **kwargs) -> None:
        """No-op for in-memory storage."""
        pass


def get_in_memory_db() -> InMemoryDB:
    """Get in-memory database instance."""
    return InMemoryDB()
