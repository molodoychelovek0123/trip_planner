from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/trips", tags=["flights"])

@router.get("/{trip_id}/flights")
async def get_flights(trip_id: str, db: Session = Depends(get_db)):
    flights = db.query(models.Flight).filter(models.Flight.trip_id == trip_id).all()
    return flights

@router.post("/{trip_id}/flights")
async def add_flight(trip_id: str, request: dict, db: Session = Depends(get_db)):
    dep_time_str = request.get("departure_time")
    arr_time_str = request.get("arrival_time")
    
    dep_time = datetime.fromisoformat(dep_time_str.replace("Z", "+00:00")) if dep_time_str else datetime.utcnow()
    arr_time = datetime.fromisoformat(arr_time_str.replace("Z", "+00:00")) if arr_time_str else datetime.utcnow()

    flight = models.Flight(
        id=str(uuid.uuid4()),
        trip_id=trip_id,
        flight_number=request.get("flight_number", "UNKNOWN"),
        departure_airport=request.get("departure_airport", ""),
        arrival_airport=request.get("arrival_airport", ""),
        departure_time=dep_time,
        arrival_time=arr_time,
        confirmation_code=request.get("confirmation_code"),
        price=float(request.get("price")) if request.get("price") else None
    )
    db.add(flight)
    db.commit()
    return flight

@router.delete("/{trip_id}/flights/{flight_id}")
async def delete_flight(trip_id: str, flight_id: str, db: Session = Depends(get_db)):
    db.query(models.Flight).filter(models.Flight.id == flight_id, models.Flight.trip_id == trip_id).delete()
    db.commit()
    return {"status": "success"}
