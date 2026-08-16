from sqlalchemy import Column, String, Float, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    trips = relationship("Trip", back_populates="user")

class Place(Base):
    __tablename__ = "places"
    id = Column(String, primary_key=True, default=generate_uuid)
    google_place_id = Column(String, unique=True, index=True)
    name = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    recommended_duration = Column(Integer, default=30)
    created_at = Column(DateTime, default=datetime.utcnow)

class Trip(Base):
    __tablename__ = "trips"
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    title = Column(String)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="trips")
    days = relationship("TripDay", back_populates="trip")

class TripDay(Base):
    __tablename__ = "trip_days"
    id = Column(String, primary_key=True, default=generate_uuid)
    trip_id = Column(String, ForeignKey("trips.id"))
    day_index = Column(Integer)
    start_time = Column(String)
    start_hotel_place_id = Column(String, ForeignKey("places.id"), nullable=True)
    end_hotel_place_id = Column(String, ForeignKey("places.id"), nullable=True)

    trip = relationship("Trip", back_populates="days")
    items = relationship("TripItem", back_populates="day")

class TripItem(Base):
    __tablename__ = "trip_items"
    id = Column(String, primary_key=True, default=generate_uuid)
    day_id = Column(String, ForeignKey("trip_days.id"))
    place_id = Column(String, ForeignKey("places.id"))
    sort_order = Column(Integer)
    user_duration = Column(Integer)
    locked_arrival_time = Column(String, nullable=True)

    day = relationship("TripDay", back_populates="items")

class RouteCache(Base):
    __tablename__ = "route_cache"
    id = Column(String, primary_key=True, default=generate_uuid)
    origin_id = Column(String, index=True)
    dest_id = Column(String, index=True)
    mode = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    data_json = Column(String) # Storing JSON as text string

class EventLog(Base):
    __tablename__ = "event_logs"
    id = Column(String, primary_key=True, default=generate_uuid)
    event_type = Column(String)
    data_json = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
