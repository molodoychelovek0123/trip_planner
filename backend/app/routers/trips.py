import uuid
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import os

from ..database import get_db
from .. import models
from ..dependencies import get_current_user
from ..utils.events import log_event
from ..services import scheduler

GOOGLE_MAPS_API_KEY = os.getenv("VITE_GOOGLE_MAPS_API_KEY", "")

router = APIRouter(
    prefix="/api/trips",
    tags=["trips"],
)

@router.get("")
async def get_trips(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns a list of trips for the current user.
    """
    trips = db.query(models.Trip).filter(models.Trip.user_id == current_user.id).all()

    return [
        {
            "id": t.id,
            "title": t.title,
            "created_at": t.created_at,
            "is_public": t.is_public
        }
        for t in trips
    ]


@router.post("")
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


@router.get("/{trip_id}")
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


@router.patch("/{trip_id}")
async def update_trip(trip_id: str, request: dict, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Synchronizes the full trip state (Days and Items) from the frontend to the backend.
    """
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this trip")

    # Clear old days/items for this trip
    db.query(models.TripItem).filter(models.TripItem.day_id.in_([day.id for day in trip.days])).delete(synchronize_session=False)
    db.query(models.TripDay).filter(models.TripDay.trip_id == trip_id).delete()
    db.commit()

    # Insert or update places from triplist
    triplist_data = request.get('triplist', [])
    for place_data in triplist_data:
        place_id = place_data.get('id')
        if not place_id:
            continue
        existing_place = db.query(models.Place).filter(models.Place.id == place_id).first()
        if not existing_place:
            new_place = models.Place(
                id=place_id,
                google_place_id=place_data.get('google_place_id') or f"custom_{place_id}",
                name=place_data.get('name', 'Custom Place'),
                lat=place_data.get('lat', 0.0),
                lng=place_data.get('lng', 0.0),
                city=place_data.get('city'),
                recommended_duration=place_data.get('recommendedDuration', 30)
            )
            db.add(new_place)
            db.commit()
        else:
            # Update place details
            if place_data.get('name'):
                existing_place.name = place_data['name']
            if place_data.get('lat') is not None:
                existing_place.lat = place_data['lat']
            if place_data.get('lng') is not None:
                existing_place.lng = place_data['lng']
            if place_data.get('city'):
                existing_place.city = place_data['city']
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


@router.delete("/{trip_id}")
async def delete_trip(trip_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Deletes a trip and all its dependent days and items.
    """
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this trip")

    db.query(models.TripItem).filter(models.TripItem.day_id.in_([day.id for day in trip.days])).delete(synchronize_session=False)
    db.query(models.TripDay).filter(models.TripDay.trip_id == trip_id).delete()
    db.delete(trip)
    db.commit()
    return {"status": "success"}


@router.post("/{trip_id}/duplicate")
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
