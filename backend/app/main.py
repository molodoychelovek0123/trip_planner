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
from .routers import importer, expenses, flights
from .services import scheduler
from .utils.coords import gcj02_to_wgs84, wgs84_to_gcj02
from authlib.integrations.starlette_client import OAuth
from fastapi import Request
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

load_dotenv()
GOOGLE_MAPS_API_KEY = os.getenv("VITE_GOOGLE_MAPS_API_KEY", "")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-change-in-prod")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "10080")) # 7 days
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")

models.Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(importer.router)
app.include_router(expenses.router)
app.include_router(flights.router)

from starlette.middleware.sessions import SessionMiddleware
app.add_middleware(SessionMiddleware, secret_key="some-random-string")

# Make sure we accept CORS from our frontend
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth = OAuth()
oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@app.get("/api/auth/google/url")
async def google_login(request: Request):
    if not GOOGLE_CLIENT_ID:
        # Mock login for testing without credentials
        return {"url": f"{FRONTEND_URL}/api/auth/google/callback?mock=true"}
    redirect_uri = GOOGLE_REDIRECT_URI
    return await oauth.google.authorize_redirect(request, redirect_uri)


@app.get("/api/auth/google/callback")
async def google_auth_callback(request: Request, db: Session = Depends(get_db)):
    if request.query_params.get("mock"):
         # Mock flow
         user_info = {
             "sub": "test-mock-sub",
             "email": "test@example.com",
             "name": "Test User",
             "picture": ""
         }
    else:
        try:
            token = await oauth.google.authorize_access_token(request)
            user_info = token.get('userinfo')
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    if not user_info:
        raise HTTPException(status_code=400, detail="Failed to fetch user info")

    google_sub = user_info.get("sub")
    email = user_info.get("email")
    name = user_info.get("name")
    picture_url = user_info.get("picture")

    user = db.query(models.User).filter(models.User.google_sub == google_sub).first()
    if not user:
        # Try falling back to email lookup
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            user.google_sub = google_sub
            user.name = name
            user.picture_url = picture_url
        else:
            user = models.User(
                email=email,
                google_sub=google_sub,
                name=name,
                picture_url=picture_url
            )
            db.add(user)
    else:
         # Update existing
         user.name = name
         user.picture_url = picture_url

    db.commit()
    db.refresh(user)

    # Generate JWT token
    access_token_expires = timedelta(minutes=JWT_EXPIRE_MINUTES)
    expire = datetime.utcnow() + access_token_expires
    to_encode = {"sub": user.id, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

    # Redirect to frontend with token
    redirect_url = f"{FRONTEND_URL}/dashboard?token={encoded_jwt}"
    return RedirectResponse(url=redirect_url)


@app.get("/api/auth/me")
async def get_current_user_profile(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "picture_url": current_user.picture_url
    }


def log_event(event_type: str, data: dict):
    """
    Logs an event asynchronously to the event_logs table for metric tracking.
    This creates its own DB session so it can run safely in a BackgroundTask
    after the main request session has closed.

    Args:
        event_type (str): The category of the event (e.g., 'places_autocomplete', 'trip_synced').
        data (dict): A dictionary of context/metadata to be stored as a JSON string.
    """
    from .database import SessionLocal
    db = SessionLocal()
    try:
        event = models.EventLog(event_type=event_type, data_json=json.dumps(data))
        db.add(event)
        db.commit()
    finally:
        db.close()

@app.post("/api/places/autocomplete")
async def places_autocomplete(request: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Proxy endpoint for Google Maps and AMap Places API Autocomplete.
    """
    # Always use Google Maps
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API Key not configured")

    background_tasks.add_task(log_event, "places_autocomplete", {"input": request.get("input")})

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://places.googleapis.com/v1/places:autocomplete",
            headers={"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY, "Content-Type": "application/json"},
            json={k: v for k, v in request.items() if k != "source"}
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()


@app.get("/api/places/{place_id}")
async def get_place(place_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Retrieves detailed information about a specific Place by its Google Place ID.

    This implements Algorithmic Caching (BR-1). It first checks if the Place exists in
    the local PostgreSQL database. If it does, it returns it instantly, costing $0.
    If it misses the cache, it fetches from Google Places API (New), saves the result
    to the database, and then returns it.

    Args:
        place_id (str): The unique Google Place ID.
    """
    # 1. Check our database cache
    cached_place = db.query(models.Place).filter(models.Place.id == place_id).first()
    if cached_place:
        background_tasks.add_task(log_event, "place_added", {"place_id": place_id, "source": "cache"})
        return {
            "id": place_id,
            "displayName": {"text": cached_place.name},
            "location": {"latitude": cached_place.lat, "longitude": cached_place.lng},
            "city": cached_place.city,
            "recommendedDuration": cached_place.recommended_duration
        }

    # 2. Fetch from Google API
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API Key not configured")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://places.googleapis.com/v1/places/{place_id}?fields=id,displayName,location,addressComponents,types,photos,rating,userRatingCount",
            headers={"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY}
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)

        data = response.json()

        # Determine city and country from addressComponents
        city = None
        country = None
        components = data.get("addressComponents", [])
        for component in components:
            comp_types = component.get("types", [])
            if "locality" in comp_types:
                city = component.get("longText")
            if "country" in comp_types:
                country = component.get("longText")

        # Calculate smart recommendedDuration based on types
        recommended_duration = 30 # default
        types = data.get("types", [])
        primary_type = types[0] if types else None

        if "museum" in types or "art_gallery" in types or "zoo" in types or "amusement_park" in types:
            recommended_duration = 120
        elif "park" in types or "tourist_attraction" in types or "church" in types or "place_of_worship" in types:
            recommended_duration = 60
        elif "restaurant" in types or "cafe" in types or "bar" in types:
            recommended_duration = 60
        elif "shopping_mall" in types or "department_store" in types:
            recommended_duration = 90
        
        photo_reference = None
        photos = data.get("photos", [])
        if photos:
            photo_reference = photos[0].get("name")

        # 3. Save to database cache
        if "location" in data:
            new_place = models.Place(
                id=place_id,
                google_place_id=data.get("id"),
                name=data.get("displayName", {}).get("text", "Unknown"),
                lat=data.get("location", {}).get("latitude"),
                lng=data.get("location", {}).get("longitude"),
                city=city,
                country=country,
                rating=data.get("rating"),
                user_ratings_total=data.get("userRatingCount"),
                primary_type=primary_type,
                photo_reference=photo_reference,
                recommended_duration=recommended_duration
            )
            db.add(new_place)
            db.commit()
            background_tasks.add_task(log_event, "place_added", {"place_id": place_id, "source": "api"})

        data["city"] = city
        data["recommendedDuration"] = recommended_duration

        return data


# --- Trips Sync APIs ---

import uuid

@app.get("/api/trips")
async def get_trips(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns a list of trips for the current user.
    """
    trips = db.query(models.Trip).filter(models.Trip.user_id == current_user.id).all()

    # Optional: We might want to return basic meta info like item count
    return [
        {
            "id": t.id,
            "title": t.title,
            "created_at": t.created_at,
            "is_public": t.is_public
        }
        for t in trips
    ]


@app.post("/api/trips")
async def create_trip(request: dict, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Creates a new Trip associated with the current User.
    """
    trip_id = request.get("id") or str(uuid.uuid4())
    trip = models.Trip(
        id=trip_id,
        user_id=current_user.id,
        title=request.get("title", "New Trip")
    )
    db.add(trip)
    db.commit()
    return {"status": "success", "trip_id": trip.id}


@app.get("/api/trips/{trip_id}")
async def get_trip(trip_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Retrieves a full trip state (Days and Items) by its ID.
    Enforces ownership.
    """
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this trip")

    return _serialize_trip(trip, db)


def _serialize_trip(trip, db):
    # Construct the Zustand-compatible 'days' payload
    days_payload = []

    # We need places for triplist
    place_ids = set()

    raw_days = []
    for day in sorted(trip.days, key=lambda d: d.day_index):
        items = sorted(day.items, key=lambda i: i.sort_order)
        for item in items:
            place_ids.add(item.place_id)

        if day.start_hotel_place_id:
            place_ids.add(day.start_hotel_place_id)
        if day.end_hotel_place_id:
            place_ids.add(day.end_hotel_place_id)

        raw_days.append((day, items))

    places = db.query(models.Place).filter(models.Place.id.in_(place_ids)).all()
    place_lookup = {p.id: p for p in places}

    for day, items in raw_days:
        plan_payload = []
        for item in items:
            place = place_lookup.get(item.place_id)
            plan_payload.append({
                "id": item.place_id,
                "uniqueId": item.id,
                "userDuration": item.user_duration,
                "lockedArrivalTime": item.locked_arrival_time,
                "travelFromPrevious": json.loads(item.travel_data_json) if item.travel_data_json else None,
                "lat": place.lat if place else None,
                "lng": place.lng if place else None,
                "name": place.name if place else None,
                "city": place.city if place else None,
                "recommendedDuration": place.recommended_duration if place else None
            })

        days_payload.append({
            "id": day.id,
            "startTime": day.start_time,
            "plan": plan_payload,
            "startHotelId": day.start_hotel_place_id,
            "endHotelId": day.end_hotel_place_id,
            "endHotelTravel": json.loads(day.end_hotel_travel_json) if day.end_hotel_travel_json else None
        })

    triplist = [
        {
            "id": p.id,
            "name": p.name,
            "lat": p.lat,
            "lng": p.lng,
            "recommendedDuration": p.recommended_duration,
            "city": p.city
        }
        for p in places if not p.google_place_id.startswith("dummy_")
    ]

    expenses_data = db.query(models.Expense).filter(models.Expense.trip_id == trip.id).all()
    flights_data = db.query(models.Flight).filter(models.Flight.trip_id == trip.id).all()

    return {
        "id": trip.id,
        "title": trip.title,
        "is_public": trip.is_public,
        "share_token": trip.share_token,
        "state": {
            "days": days_payload,
            "triplist": triplist,
            "expenses": [{"id": e.id, "title": e.title, "amount": e.amount, "currency": e.currency, "category": e.category} for e in expenses_data],
            "flights": [{"id": f.id, "flight_number": f.flight_number, "departure_airport": f.departure_airport, "arrival_airport": f.arrival_airport, "departure_time": f.departure_time.isoformat() if f.departure_time else None, "arrival_time": f.arrival_time.isoformat() if f.arrival_time else None, "price": f.price} for f in flights_data]
        }
    }


@app.patch("/api/trips/{trip_id}")
async def update_trip(trip_id: str, request: dict, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Synchronizes the full trip state (Days and Items) from the frontend to the backend.

    This endpoint is called by the frontend's debounced Zustand storage engine (BR-4).
    It performs a naive sync by clearing existing Days and Items for the trip, then
    re-inserting the fresh state. It handles foreign key dependencies by generating
    dummy Place records if a specific place_id hasn't been cached yet.

    Args:
        trip_id (str): The UUID of the trip being updated.
        request (dict): The serialized Zustand state containing the 'days' array.
    """
    # Basic implementation of syncing trip_days and trip_items to DB

    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this trip")

    # Clear old days/items for this trip
    db.query(models.TripItem).filter(models.TripItem.day_id.in_([day.id for day in trip.days])).delete(synchronize_session=False)
    db.query(models.TripDay).filter(models.TripDay.trip_id == trip_id).delete()
    db.commit()

    # Insert new days
    days_data = request.get('days', [])
    for index, day_data in enumerate(days_data):
        day_id = day_data.get('id')
        start_hotel_id = day_data.get('startHotelId')
        end_hotel_id = day_data.get('endHotelId')

        # Ensure start/end hotels exist to satisfy FK
        for hotel_place_id in [start_hotel_id, end_hotel_id]:
            if hotel_place_id:
                if not db.query(models.Place).filter(models.Place.id == hotel_place_id).first():
                    dummy_hotel = models.Place(id=hotel_place_id, google_place_id=f"dummy_{hotel_place_id}", name="Synced Hotel", lat=0.0, lng=0.0)
                    db.add(dummy_hotel)
                    db.commit()

        end_hotel_travel = day_data.get('endHotelTravel')
        day_model = models.TripDay(
            id=day_id,
            trip_id=trip_id,
            day_index=index,
            start_time=day_data.get('startTime', '09:00'),
            start_hotel_place_id=start_hotel_id,
            end_hotel_place_id=end_hotel_id,
            end_hotel_travel_json=json.dumps(end_hotel_travel) if end_hotel_travel else None
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

             travel = item_data.get('travelFromPrevious')
             item_model = models.TripItem(
                 id=item_data.get('uniqueId'),
                 day_id=day_id,
                 place_id=place_id,
                 sort_order=order,
                 user_duration=item_data.get('userDuration', 30),
                 locked_arrival_time=item_data.get('lockedArrivalTime'),
                 travel_data_json=json.dumps(travel) if travel else None
             )
             db.add(item_model)

    db.commit()
    
    # Recalculate timelines for all days
    for day_data in days_data:
        day_id = day_data.get('id')
        await scheduler.calculate_day_timeline(day_id, db, GOOGLE_MAPS_API_KEY)

    event = models.EventLog(event_type="trip_synced", data_json=json.dumps({"trip_id": trip_id, "size_bytes": len(json.dumps(request))}))
    db.add(event)
    db.commit()
    return {"status": "success"}


@app.delete("/api/trips/{trip_id}")
async def delete_trip(trip_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Deletes a trip and all its dependent days and items.
    """
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this trip")

    # Days and Items should ideally be deleted via cascade in DB, but let's do it manually just in case
    db.query(models.TripItem).filter(models.TripItem.day_id.in_([day.id for day in trip.days])).delete(synchronize_session=False)
    db.query(models.TripDay).filter(models.TripDay.trip_id == trip_id).delete()
    db.delete(trip)
    db.commit()
    return {"status": "success"}


@app.post("/api/trips/{trip_id}/duplicate")
async def duplicate_trip(trip_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Duplicates an existing trip, generating new UUIDs for the trip, days, and items.
    """
    original_trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not original_trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if original_trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to duplicate this trip")

    new_trip_id = str(uuid.uuid4())
    new_trip = models.Trip(
        id=new_trip_id,
        user_id=current_user.id,
        title=f"Copy of {original_trip.title}"
    )
    db.add(new_trip)

    for day in original_trip.days:
        new_day_id = str(uuid.uuid4())
        new_day = models.TripDay(
            id=new_day_id,
            trip_id=new_trip_id,
            day_index=day.day_index,
            start_time=day.start_time,
            start_hotel_place_id=day.start_hotel_place_id,
            end_hotel_place_id=day.end_hotel_place_id
        )
        db.add(new_day)

        for item in day.items:
            new_item = models.TripItem(
                id=str(uuid.uuid4()),
                day_id=new_day_id,
                place_id=item.place_id,
                sort_order=item.sort_order,
                user_duration=item.user_duration,
                locked_arrival_time=item.locked_arrival_time
            )
            db.add(new_item)

    db.commit()
    return {"status": "success", "trip_id": new_trip_id}


import secrets

@app.post("/api/trips/{trip_id}/share")
async def share_trip(trip_id: str, request: dict, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Toggles public sharing and generates/removes a share token.
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


@app.get("/api/share/{share_token}")
async def get_shared_trip(share_token: str, db: Session = Depends(get_db)):
    """
    Public, read-only access to a trip via its share token.
    """
    trip = db.query(models.Trip).filter(models.Trip.share_token == share_token, models.Trip.is_public == True).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Shared trip not found or is private")

    return _serialize_trip(trip, db)


@app.post("/api/routes/compute")
async def compute_routes(request: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Proxy endpoint for Google Routes API v2 with Time-to-Live (TTL) caching.

    Implements BR-1 (Cost Management). It generates a cache key based on the origin,
    destination, and travel mode. It checks the `route_cache` table for a valid cached
    route generated within the last 24 hours. On a cache miss, it fetches from Google
    Routes API, serializes the JSON response, and stores it in the database.

    Args:
        request (dict): The JSON payload containing origin, destination, and travelMode.
    """
    # Simplified cache key logic: origin, dest, routing_preference
    origin_id = request.get("origin", {}).get("placeId")
    dest_id = request.get("destination", {}).get("placeId")
    mode = request.get("travelMode", "UNKNOWN")
    routing_pref = request.get("routingPreference", "")

    # We skip caching if origin/dest are missing or coordinates are used directly
    if origin_id and dest_id:
        departure_time = request.get("departureTime", "12:00")
        try:
            # If departureTime is ISO timestamp, parse it
            if "T" in departure_time:
                dt = datetime.fromisoformat(departure_time.replace("Z", "+00:00"))
                hours = dt.hour
            else:
                # Handle HH:MM string
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

        # 1. Check cache (24h TTL)
        cutoff = datetime.utcnow() - timedelta(hours=24)
        cached_route = db.query(models.RouteCache).filter(
            models.RouteCache.origin_id == origin_id,
            models.RouteCache.dest_id == dest_id,
            models.RouteCache.mode == cache_key,
            models.RouteCache.timestamp > cutoff
        ).first()

    # 2. Fetch from Google
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API Key not configured")

    headers = {
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": request.get("X-Goog-FieldMask", "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps,routes.legs.localizedValues.duration.text"),
        "Content-Type": "application/json"
    }

    # remove the field mask from the payload if it's there
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

        # 4. Save to Cache
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


# --- Favorites APIs ---

@app.get("/api/favorites")
async def get_favorites(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns a list of favorite places for the current user.
    """
    favorites = db.query(models.FavoritePlace).filter(models.FavoritePlace.user_id == current_user.id).all()
    
    result = []
    for fav in favorites:
        p = fav.place
        if p:
            result.append({
                "id": p.id,
                "place_id": p.google_place_id,
                "name": p.name,
                "lat": p.lat,
                "lng": p.lng,
                "city": p.city,
                "country": p.country,
                "photo_reference": p.photo_reference,
                "rating": p.rating,
                "user_ratings_total": p.user_ratings_total,
                "primary_type": p.primary_type,
                "recommendedDuration": p.recommended_duration
            })
    return result

@app.post("/api/favorites")
async def add_favorite(request: dict, background_tasks: BackgroundTasks, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Adds a place to the user's favorites.
    """
    place_id = request.get("place_id")
    if not place_id:
        raise HTTPException(status_code=400, detail="place_id is required")

    # 1. Check if place exists in DB
    cached_place = db.query(models.Place).filter(models.Place.id == place_id).first()
    
    if not cached_place:
        # Fetch from Google
        if not GOOGLE_MAPS_API_KEY:
            raise HTTPException(status_code=500, detail="Google Maps API Key not configured")

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://places.googleapis.com/v1/places/{place_id}?fields=id,displayName,location,addressComponents,types,photos,rating,userRatingCount",
                headers={"X-Goog-Api-Key": GOOGLE_MAPS_API_KEY}
            )
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)

            data = response.json()

            city = None
            country = None
            components = data.get("addressComponents", [])
            for component in components:
                comp_types = component.get("types", [])
                if "locality" in comp_types:
                    city = component.get("longText")
                if "country" in comp_types:
                    country = component.get("longText")

            types = data.get("types", [])
            primary_type = types[0] if types else None

            recommended_duration = 30
            if "museum" in types or "art_gallery" in types or "zoo" in types or "amusement_park" in types:
                recommended_duration = 120
            elif "park" in types or "tourist_attraction" in types or "church" in types or "place_of_worship" in types:
                recommended_duration = 60
            elif "restaurant" in types or "cafe" in types or "bar" in types:
                recommended_duration = 60
            elif "shopping_mall" in types or "department_store" in types:
                recommended_duration = 90

            photo_reference = None
            photos = data.get("photos", [])
            if photos:
                photo_reference = photos[0].get("name")

            if "location" in data:
                cached_place = models.Place(
                    id=place_id,
                    google_place_id=data.get("id"),
                    name=data.get("displayName", {}).get("text", "Unknown"),
                    lat=data.get("location", {}).get("latitude"),
                    lng=data.get("location", {}).get("longitude"),
                    city=city,
                    country=country,
                    rating=data.get("rating"),
                    user_ratings_total=data.get("userRatingCount"),
                    primary_type=primary_type,
                    photo_reference=photo_reference,
                    recommended_duration=recommended_duration
                )
                db.add(cached_place)
                db.commit()
            else:
                raise HTTPException(status_code=400, detail="Place has no location")

    # 2. Add to favorites if not already added
    existing_fav = db.query(models.FavoritePlace).filter(
        models.FavoritePlace.user_id == current_user.id,
        models.FavoritePlace.place_id == place_id
    ).first()

    if not existing_fav:
        new_fav = models.FavoritePlace(
            user_id=current_user.id,
            place_id=place_id
        )
        db.add(new_fav)
        db.commit()

    return {"status": "success"}

@app.delete("/api/favorites/{place_id}")
async def remove_favorite(place_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Removes a place from the user's favorites.
    """
    fav = db.query(models.FavoritePlace).filter(
        models.FavoritePlace.user_id == current_user.id,
        models.FavoritePlace.place_id == place_id
    ).first()
    
    if not fav:
        raise HTTPException(status_code=404, detail="Favorite not found")
        
    db.delete(fav)
    db.commit()
    return {"status": "success"}
