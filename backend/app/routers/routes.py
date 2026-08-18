import os
import json
import httpx
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from ..database import get_db
from .. import models
from ..utils.events import log_event

load_dotenv()
GOOGLE_MAPS_API_KEY = os.getenv("VITE_GOOGLE_MAPS_API_KEY", "")

router = APIRouter(
    prefix="/api/routes",
    tags=["routes"],
)

@router.post("/compute")
async def compute_routes(request: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Proxy endpoint for Google Routes API v2 with Time-to-Live (TTL) caching.
    """
    origin_id = request.get("origin", {}).get("placeId")
    dest_id = request.get("destination", {}).get("placeId")
    mode = request.get("travelMode", "UNKNOWN")
    routing_pref = request.get("routingPreference", "")

    if origin_id and dest_id:
        departure_time = request.get("departureTime", "12:00")
        try:
            if "T" in departure_time:
                dt = datetime.fromisoformat(departure_time.replace("Z", "+00:00"))
                hours = dt.hour
            else:
                hours = int(departure_time.split(":")[0])
        except Exception:
            hours = 12

        if 6 <= hours < 12:
            time_of_day = "morning"
        elif 12 <= hours < 17:
            time_of_day = "day"
        elif 17 <= hours < 22:
            time_of_day = "evening"
        else:
            time_of_day = "night"

        cache_key = f"{mode}_{routing_pref}_{time_of_day}"

        cutoff = datetime.utcnow() - timedelta(hours=24)
        cached_route = db.query(models.RouteCache).filter(
            models.RouteCache.origin_id == origin_id,
            models.RouteCache.dest_id == dest_id,
            models.RouteCache.mode == cache_key,
            models.RouteCache.timestamp > cutoff
        ).first()
        
        if cached_route:
            return json.loads(cached_route.data_json)

    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API Key not configured")

    headers = {
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": request.get("X-Goog-FieldMask", "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps,routes.legs.localizedValues.duration.text"),
        "Content-Type": "application/json"
    }

    payload = {k: v for k, v in request.items() if k not in ["X-Goog-FieldMask", "source"]}

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://routes.googleapis.com/directions/v2:computeRoutes",
            headers=headers,
            json=payload
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)

        data = response.json()

        if origin_id and dest_id and data.get("routes"):
            new_cache = models.RouteCache(
                origin_id=origin_id,
                dest_id=dest_id,
                mode=cache_key,
                data_json=json.dumps(data)
            )
            db.add(new_cache)
            db.commit()
            background_tasks.add_task(log_event, "route_calculated", {"origin": origin_id, "dest": dest_id, "mode": mode, "source": "api"})

        return data
