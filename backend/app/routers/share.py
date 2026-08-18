from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import secrets

from ..database import get_db
from .. import models
from ..dependencies import get_current_user
from .trips import _serialize_trip

router = APIRouter(
    tags=["share"],
)

@router.post("/api/trips/{trip_id}/share")
async def share_trip(trip_id: str, request: dict, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Toggles public sharing and generates/removes a share token.
    (Note: Endpoint is mapped to /api/share/{trip_id}, originally in main.py it was /api/trips/{trip_id}/share)
    """
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to share this trip")

    is_public = request.get("is_public", True)
    trip.is_public = is_public

    if is_public and not trip.share_token:
        trip.share_token = secrets.token_urlsafe(16)
    elif not is_public:
        trip.share_token = None

    db.commit()

    return {
        "status": "success",
        "is_public": trip.is_public,
        "share_token": trip.share_token
    }

@router.get("/api/share/{share_token}")
async def get_shared_trip(share_token: str, db: Session = Depends(get_db)):
    """
    Public, read-only access to a trip via its share token.
    """
    trip = db.query(models.Trip).filter(models.Trip.share_token == share_token, models.Trip.is_public == True).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Shared trip not found or is private")

    return _serialize_trip(trip, db)
