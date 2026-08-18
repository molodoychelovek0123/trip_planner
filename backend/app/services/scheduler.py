from sqlalchemy.orm import Session
import httpx
import json
from datetime import datetime
from .. import models

async def get_route(origin_place_id: str, dest_place_id: str, db: Session, api_key: str, departure_time: str = "12:00", mode: str = "TRANSIT"):
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

    cache_key = f"{mode}__{time_of_day}"

    # 1. Check RouteCache
    cached_route = db.query(models.RouteCache).filter(
        models.RouteCache.origin_id == origin_place_id,
        models.RouteCache.dest_id == dest_place_id,
        models.RouteCache.mode == cache_key
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
        
        # Include departure time if it's a future ISO string, but for now we just cache by time of day.
        # Google Routes API expects departureTime in RFC3339 UTC format. 
        # Since we just want to leverage the cache segmentation, we can omit it in the Google call 
        # or pass a dummy date with the correct hour if we really need traffic data.
        # For this implementation, we rely on the segmented caching.
        
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
                    mode=cache_key,
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
    
    def time_to_minutes(time_str: str) -> int:
        try:
            h, m = map(int, time_str.split(':'))
            return h * 60 + m
        except:
            return 9 * 60

    def minutes_to_time(minutes: int) -> str:
        h = (minutes // 60) % 24
        m = minutes % 60
        return f"{h:02d}:{m:02d}"

    current_minutes = time_to_minutes(day.start_time)
    
    for index, item in enumerate(items):
        dest_id = item.place_id
        
        if item.locked_arrival_time:
            current_minutes = time_to_minutes(item.locked_arrival_time)
            
        departure_time_str = minutes_to_time(current_minutes)

        if current_origin_id and dest_id:
            route_data = await get_route(current_origin_id, dest_id, db, api_key, departure_time=departure_time_str, mode="TRANSIT")
            if route_data and "routes" in route_data and len(route_data["routes"]) > 0:
                route = route_data["routes"][0]
                duration_seconds = int(route.get("duration", "0s").replace("s", ""))
                # Preserve existing fields like routeAlternatives and mode
                existing_travel = {}
                if item.travel_data_json:
                    try:
                        existing_travel = json.loads(item.travel_data_json)
                    except Exception:
                        pass
                        
                existing_travel["distanceMeters"] = route.get("distanceMeters", 0)
                existing_travel["durationSeconds"] = duration_seconds
                existing_travel["durationMinutes"] = duration_seconds // 60
                item.travel_data_json = json.dumps(existing_travel)
                current_minutes += duration_seconds // 60
            else:
                existing_travel = {}
                if item.travel_data_json:
                    try:
                        existing_travel = json.loads(item.travel_data_json)
                    except Exception:
                        pass
                existing_travel["error"] = "No route found"
                item.travel_data_json = json.dumps(existing_travel)
        
        # Advance the origin and time
        current_origin_id = dest_id
        current_minutes += item.user_duration
        
    # Route from last item back to end hotel
    if current_origin_id and day.end_hotel_place_id:
        departure_time_str = minutes_to_time(current_minutes)
        route_data = await get_route(current_origin_id, day.end_hotel_place_id, db, api_key, departure_time=departure_time_str, mode="TRANSIT")
        if route_data and "routes" in route_data and len(route_data["routes"]) > 0:
            route = route_data["routes"][0]
            # Preserve existing fields like routeAlternatives and mode
            existing_travel = {}
            if day.end_hotel_travel_json:
                try:
                    existing_travel = json.loads(day.end_hotel_travel_json)
                except Exception:
                    pass
                    
            duration_seconds = int(route.get("duration", "0s").replace("s", ""))
            existing_travel["distanceMeters"] = route.get("distanceMeters", 0)
            existing_travel["durationSeconds"] = duration_seconds
            existing_travel["durationMinutes"] = duration_seconds // 60
            day.end_hotel_travel_json = json.dumps(existing_travel)
        else:
            existing_travel = {}
            if day.end_hotel_travel_json:
                try:
                    existing_travel = json.loads(day.end_hotel_travel_json)
                except Exception:
                    pass
            existing_travel["error"] = "No route found"
            day.end_hotel_travel_json = json.dumps(existing_travel)
            
    db.commit()
    return True
