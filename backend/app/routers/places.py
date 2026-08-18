import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from ..database import get_db
from .. import models
from ..utils.events import log_event

load_dotenv()
GOOGLE_MAPS_API_KEY = os.getenv("VITE_GOOGLE_MAPS_API_KEY", "")

router = APIRouter(
    prefix="/api/places",
    tags=["places"],
)

@router.post("/autocomplete")
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


@router.get("/{place_id}")
async def get_place(place_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Retrieves detailed information about a specific Place by its Google Place ID.
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
