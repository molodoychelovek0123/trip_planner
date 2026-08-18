import json
from .. import models
from ..database import SessionLocal

def log_event(event_type: str, data: dict):
    """
    Logs an event asynchronously to the event_logs table for metric tracking.
    This creates its own DB session so it can run safely in a BackgroundTask
    after the main request session has closed.

    Args:
        event_type (str): The category of the event (e.g., 'places_autocomplete', 'trip_synced').
        data (dict): A dictionary of context/metadata to be stored as a JSON string.
    """
    db = SessionLocal()
    try:
        event = models.EventLog(event_type=event_type, data_json=json.dumps(data))
        db.add(event)
        db.commit()
    finally:
        db.close()
