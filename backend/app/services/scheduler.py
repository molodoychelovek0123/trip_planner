from sqlalchemy.orm import Session
import httpx
import json
from datetime import datetime
from .. import models

async def get_route(origin_place_id: str, dest_place_id: str, db: Session, api_key: str, mode: str = "TRANSIT"):
    # 1. Check RouteCache
    cached_route = db.query(models.RouteCache).filter(
        models.RouteCache.origin_id == origin_place_id,
        models.RouteCache.dest_id == dest_place_id,
        models.RouteCache.mode == mode
    ).first()
    
    if cached_route:
        return json.loads(cached_route.data_json)
        
    # 2. Call Google Routes API
    async with httpx.AsyncClient() as client:
        req_body = {
            "origin": {"placeId": origin_place_id},
            "destination": {"placeId": dest_place_id},
            "travelMode": mode,
            "routingPreference": "ROUTING_PREFERENCE_UNSPECIFIED"
        }
        
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.legs"
        }
        
        try:
            resp = await client.post("https://routes.googleapis.com/directions/v2:computeRoutes", json=req_body, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                # 3. Save to cache
                new_cache = models.RouteCache(
                    origin_id=origin_place_id,
                    dest_id=dest_place_id,
                    mode=mode,
                    data_json=json.dumps(data)
                )
                db.add(new_cache)
                db.commit()
                return data
        except Exception as e:
            print("Error calling Routes API:", e)
            
    return None

async def calculate_day_timeline(trip_day_id: str, db: Session, api_key: str):
    """
    Recalculates travel times between consecutive places in a trip day.
    Uses algorithmic caching to minimize API costs (BR-1).
    Provides flexible time model calculations (BR-2).
    """
    day = db.query(models.TripDay).filter(models.TripDay.id == trip_day_id).first()
    if not day:
        return False
        
    items = sorted(day.items, key=lambda x: x.sort_order)
    if not items:
        return True
        
    # We trace the route: start_hotel -> item 1 -> item 2 -> ... -> end_hotel
    current_origin_id = day.start_hotel_place_id
    
    for item in items:
        dest_id = item.place_id
        if current_origin_id and dest_id:
            route_data = await get_route(current_origin_id, dest_id, db, api_key, mode="TRANSIT")
            if route_data and "routes" in route_data and len(route_data["routes"]) > 0:
                route = route_data["routes"][0]
                travel_segment = {
                    "distanceMeters": route.get("distanceMeters", 0),
                    "durationSeconds": int(route.get("duration", "0s").replace("s", "")),
                }
                item.travel_data_json = json.dumps(travel_segment)
            else:
                item.travel_data_json = json.dumps({"error": "No route found", "durationSeconds": 0})
        
        # Advance the origin
        current_origin_id = dest_id
        
    # Route from last item back to end hotel
    if current_origin_id and day.end_hotel_place_id:
        route_data = await get_route(current_origin_id, day.end_hotel_place_id, db, api_key, mode="TRANSIT")
        if route_data and "routes" in route_data and len(route_data["routes"]) > 0:
            route = route_data["routes"][0]
            travel_segment = {
                "distanceMeters": route.get("distanceMeters", 0),
                "durationSeconds": int(route.get("duration", "0s").replace("s", "")),
            }
            day.end_hotel_travel_json = json.dumps(travel_segment)
        else:
            day.end_hotel_travel_json = json.dumps({"error": "No route found", "durationSeconds": 0})
            
    db.commit()
    return True
