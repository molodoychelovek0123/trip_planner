from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import httpx
import urllib.parse
import re
import os

from ..database import get_db
from .. import models
# Import GOOGLE_MAPS_API_KEY from main or read env
GOOGLE_MAPS_API_KEY = os.getenv("VITE_GOOGLE_MAPS_API_KEY", "")

router = APIRouter(prefix="/api/import", tags=["import"])

class SingleLinkRequest(BaseModel):
    url: str

class ExtensionPlace(BaseModel):
    name: str
    lat: float | None = None
    lng: float | None = None

class ExtensionListRequest(BaseModel):
    places: list[ExtensionPlace]

@router.post("/single-link")
async def import_single_link(req: SingleLinkRequest, db: Session = Depends(get_db)):
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API key not configured")

    async with httpx.AsyncClient() as client:
        # Follow redirects to get the real URL
        try:
            r = await client.get(req.url, follow_redirects=True)
            final_url = str(r.url)
        except Exception as e:
            raise HTTPException(status_code=400, detail="Failed to fetch URL")

    # If it hit the consent page, the original url is in the 'continue' query param
    parsed_url = urllib.parse.urlparse(final_url)
    query_params = urllib.parse.parse_qs(parsed_url.query)
    
    target_url = final_url
    if "continue" in query_params:
        target_url = query_params["continue"][0]
        
    # Extract place name from the URL path, e.g. /maps/place/Shanghai+Postal+Museum/...
    match = re.search(r"/maps/place/([^/]+)/", target_url)
    if not match:
        raise HTTPException(status_code=400, detail="Could not extract place name from URL")
        
    place_name_encoded = match.group(1)
    place_name = urllib.parse.unquote_plus(place_name_encoded)
    
    # Use Places API Text Search to find it
    async with httpx.AsyncClient() as client:
        search_req = {
            "textQuery": place_name
        }
        # To make it more accurate, if we have coordinates we can add locationBias
        coord_match = re.search(r"@(-?\d+\.\d+),(-?\d+\.\d+)", target_url)
        if coord_match:
            lat = float(coord_match.group(1))
            lng = float(coord_match.group(2))
            search_req["locationBias"] = {
                "circle": {
                    "center": {"latitude": lat, "longitude": lng},
                    "radius": 50000.0 # 50km
                }
            }
            
        r_search = await client.post(
            "https://places.googleapis.com/v1/places:searchText",
            json=search_req,
            headers={
                "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.addressComponents,places.types,places.photos,places.rating,places.userRatingCount"
            }
        )
        if r_search.status_code != 200:
            raise HTTPException(status_code=500, detail="Places API search failed")
            
        data = r_search.json()
        places = data.get("places", [])
        if not places:
            raise HTTPException(status_code=404, detail="Place not found in Google Places API")
            
        p = places[0]
        place_id = p["id"]
        
        # Check if already in our cache
        db_place = db.query(models.Place).filter(models.Place.google_place_id == place_id).first()
        if not db_place:
            name = p.get("displayName", {}).get("text", "Unknown")
            lat = p.get("location", {}).get("latitude", 0)
            lng = p.get("location", {}).get("longitude", 0)
            rating = p.get("rating")
            user_ratings_total = p.get("userRatingCount")
            
            primary_type = None
            if p.get("types"):
                primary_type = p["types"][0]
                
            photo_reference = None
            if p.get("photos"):
                photo_reference = p["photos"][0].get("name")
                
            city = None
            country = None
            for comp in p.get("addressComponents", []):
                types = comp.get("types", [])
                if "locality" in types:
                    city = comp.get("longText")
                if "country" in types:
                    country = comp.get("longText")

            db_place = models.Place(
                google_place_id=place_id,
                name=name,
                lat=lat,
                lng=lng,
                city=city,
                country=country,
                photo_reference=photo_reference,
                rating=rating,
                user_ratings_total=user_ratings_total,
                primary_type=primary_type
            )
            db.add(db_place)
            db.commit()
            db.refresh(db_place)
            
    return {"status": "success", "place_id": db_place.id, "google_place_id": db_place.google_place_id, "name": db_place.name}

@router.post("/extension-list")
async def import_extension_list(req: ExtensionListRequest, db: Session = Depends(get_db)):
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API key not configured")
        
    results = []
    
    async with httpx.AsyncClient() as client:
        for item in req.places:
            search_req = {"textQuery": item.name}
            if item.lat and item.lng:
                search_req["locationBias"] = {
                    "circle": {
                        "center": {"latitude": item.lat, "longitude": item.lng},
                        "radius": 10000.0
                    }
                }
                
            r_search = await client.post(
                "https://places.googleapis.com/v1/places:searchText",
                json=search_req,
                headers={
                    "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                    "X-Goog-FieldMask": "places.id,places.displayName,places.location"
                }
            )
            
            if r_search.status_code == 200:
                data = r_search.json()
                places = data.get("places", [])
                if places:
                    p = places[0]
                    results.append({
                        "original_name": item.name,
                        "google_place_id": p["id"],
                        "name": p.get("displayName", {}).get("text", "Unknown"),
                        "lat": p.get("location", {}).get("latitude"),
                        "lng": p.get("location", {}).get("longitude")
                    })
                    # We could also insert them into the DB cache here, but for brevity, returning them to frontend
                    # so the frontend can display them and let the user add them to the trip.

    return {"status": "success", "imported_places": results}
