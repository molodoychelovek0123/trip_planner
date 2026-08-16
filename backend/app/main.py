from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_
import httpx
from datetime import datetime, timedelta
import json
import os
from dotenv import load_dotenv
from .database import get_db, engine
from . import models

load_dotenv()
GOOGLE_MAPS_API_KEY = os.getenv("VITE_GOOGLE_MAPS_API_KEY", "")

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Make sure we accept CORS from our frontend
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def log_event(db: Session, event_type: str, data: dict):
    event = models.EventLog(event_type=event_type, data_json=json.dumps(data))
    db.add(event)
    db.commit()

@app.post("/api/places/autocomplete")
async def places_autocomplete(request: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API Key not configured")

    background_tasks.add_task(log_event, db, "places_autocomplete", {"input": request.get("input")})

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://places.googleapis.com/v1/places:autocomplete",
            headers={"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY, "Content-Type": "application/json"},
            json=request
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()


@app.get("/api/places/{place_id}")
async def get_place(place_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # 1. Check our database cache
    cached_place = db.query(models.Place).filter(models.Place.google_place_id == place_id).first()
    if cached_place:
        background_tasks.add_task(log_event, db, "place_added", {"place_id": place_id, "source": "cache"})
        return {
            "id": place_id,
            "displayName": {"text": cached_place.name},
            "location": {"latitude": cached_place.lat, "longitude": cached_place.lng}
        }

    # 2. If not found, fetch from Google API
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API Key not configured")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://places.googleapis.com/v1/places/{place_id}?fields=id,displayName,location",
            headers={"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY}
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)

        data = response.json()

        # 3. Save to database cache
        if "location" in data:
            new_place = models.Place(
                google_place_id=data.get("id"),
                name=data.get("displayName", {}).get("text", "Unknown"),
                lat=data.get("location", {}).get("latitude"),
                lng=data.get("location", {}).get("longitude")
            )
            db.add(new_place)
            db.commit()
            background_tasks.add_task(log_event, db, "place_added", {"place_id": place_id, "source": "api"})

        return data


# --- Trips Sync APIs ---

@app.post("/api/trips")
async def create_trip(request: dict, db: Session = Depends(get_db)):
    # Mock user ID for now
    user_id = "test-user-id"
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        user = models.User(id=user_id, email="test@example.com")
        db.add(user)
        db.commit()

    trip = models.Trip(
        id=request.get("id"),
        user_id=user_id,
        title=request.get("title", "New Trip")
    )
    db.add(trip)
    db.commit()
    return {"status": "success", "trip_id": trip.id}

@app.patch("/api/trips/{trip_id}")
async def update_trip(trip_id: str, request: dict, db: Session = Depends(get_db)):
    # Basic implementation of syncing trip_days and trip_items to DB

    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        trip = models.Trip(id=trip_id, user_id="test-user-id", title="Synced Trip")
        db.add(trip)
        db.commit()

    # Clear old days/items for this trip
    db.query(models.TripItem).filter(models.TripItem.day_id.in_([day.id for day in trip.days])).delete(synchronize_session=False)
    db.query(models.TripDay).filter(models.TripDay.trip_id == trip_id).delete()
    db.commit()

    # Insert new days
    days_data = request.get('days', [])
    for index, day_data in enumerate(days_data):
        day_id = day_data.get('id')
        start_hotel = day_data.get('startHotel')
        end_hotel = day_data.get('endHotel')

        day_model = models.TripDay(
            id=day_id,
            trip_id=trip_id,
            day_index=index,
            start_time=day_data.get('startTime', '09:00'),
            start_hotel_place_id=start_hotel.get('id') if start_hotel else None,
            end_hotel_place_id=end_hotel.get('id') if end_hotel else None
        )
        db.add(day_model)

        items_data = day_data.get('plan', [])
        for order, item_data in enumerate(items_data):
             place_id = item_data.get('id')

             # Create a dummy place if it doesn't exist yet to satisfy FK
             existing_place = db.query(models.Place).filter(models.Place.id == place_id).first()
             if not existing_place:
                 dummy_place = models.Place(id=place_id, google_place_id=f"dummy_{place_id}", name="Synced Place", lat=0.0, lng=0.0)
                 db.add(dummy_place)
                 db.commit()

             item_model = models.TripItem(
                 id=item_data.get('uniqueId'),
                 day_id=day_id,
                 place_id=place_id,
                 sort_order=order,
                 user_duration=item_data.get('userDuration', 30),
                 locked_arrival_time=item_data.get('lockedArrivalTime')
             )
             db.add(item_model)

    db.commit()
    log_event(db, "trip_synced", {"trip_id": trip_id, "size_bytes": len(json.dumps(request))})
    return {"status": "success"}

@app.post("/api/routes/compute")
async def compute_routes(request: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Simplified cache key logic: origin, dest, routing_preference
    origin_id = request.get("origin", {}).get("placeId")
    dest_id = request.get("destination", {}).get("placeId")
    mode = request.get("travelMode", "UNKNOWN")
    routing_pref = request.get("routingPreference", "")

    # We skip caching if origin/dest are missing or coordinates are used directly
    if origin_id and dest_id:
        cache_key = f"{mode}_{routing_pref}"

        # 1. Check cache (24h TTL)
        cutoff = datetime.utcnow() - timedelta(hours=24)
        cached_route = db.query(models.RouteCache).filter(
            models.RouteCache.origin_id == origin_id,
            models.RouteCache.dest_id == dest_id,
            models.RouteCache.mode == cache_key,
            models.RouteCache.timestamp > cutoff
        ).first()

        if cached_route:
            background_tasks.add_task(log_event, db, "route_calculated", {"origin": origin_id, "dest": dest_id, "mode": mode, "source": "cache"})
            return json.loads(cached_route.data_json)

    # 2. Fetch from Google
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API Key not configured")

    headers = {
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": request.get("X-Goog-FieldMask", "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps,routes.legs.localizedValues.duration.text"),
        "Content-Type": "application/json"
    }

    # remove the field mask from the payload if it's there
    payload = {k: v for k, v in request.items() if k != "X-Goog-FieldMask"}

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://routes.googleapis.com/directions/v2:computeRoutes",
            headers=headers,
            json=payload
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)

        data = response.json()

        # 3. Save to Cache
        if origin_id and dest_id and data.get("routes"):
            cache_key = f"{mode}_{routing_pref}"
            new_cache = models.RouteCache(
                origin_id=origin_id,
                dest_id=dest_id,
                mode=cache_key,
                data_json=json.dumps(data)
            )
            db.add(new_cache)
            db.commit()
            background_tasks.add_task(log_event, db, "route_calculated", {"origin": origin_id, "dest": dest_id, "mode": mode, "source": "api"})

        return data
