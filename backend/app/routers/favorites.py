import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from ..database import get_db
from .. import models
from ..dependencies import get_current_user

load_dotenv()
GOOGLE_MAPS_API_KEY = os.getenv("VITE_GOOGLE_MAPS_API_KEY", "")

router = APIRouter(
    prefix="/api/favorites",
    tags=["favorites"],
)

@router.get("")
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

@router.post("")
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

@router.delete("/{place_id}")
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
