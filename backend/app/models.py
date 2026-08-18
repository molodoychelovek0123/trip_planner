from sqlalchemy import Column, String, Float, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    """
    Represents an authenticated user within the TripPlanner system.
    """
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True)
    google_sub = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, nullable=True)
    picture_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    trips = relationship("Trip", back_populates="user")

class Place(Base):
    """
    Represents the Global Cache of Google Places.
    Prevents duplicate external API calls by saving geographic and descriptive details.
    """
    __tablename__ = "places"
    id = Column(String, primary_key=True, default=generate_uuid)
    google_place_id = Column(String, unique=True, index=True)
    name = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    recommended_duration = Column(Integer, default=30)
    city = Column(String, nullable=True)
    country = Column(String, nullable=True)
    photo_reference = Column(String, nullable=True)
    rating = Column(Float, nullable=True)
    user_ratings_total = Column(Integer, nullable=True)
    primary_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class FavoritePlace(Base):
    """
    Represents a user's saved point of interest (favorite).
    Links a User to a Place in the global cache.
    """
    __tablename__ = "favorite_places"
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    place_id = Column(String, ForeignKey("places.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="favorite_places")
    place = relationship("Place", backref="favorited_by")

class Trip(Base):
    """
    Represents a multi-day itinerary planned by a user.
    """
    __tablename__ = "trips"
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    title = Column(String)
    is_public = Column(Boolean, default=False)
    share_token = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="trips")
    days = relationship("TripDay", back_populates="trip")

class TripDay(Base):
    """
    Represents a single day within a Trip.
    Defines the day's starting time and optional start/end hotel anchors.
    """
    __tablename__ = "trip_days"
    id = Column(String, primary_key=True, default=generate_uuid)
    trip_id = Column(String, ForeignKey("trips.id"))
    day_index = Column(Integer)
    start_time = Column(String)
    start_hotel_place_id = Column(String, ForeignKey("places.id"), nullable=True)
    end_hotel_place_id = Column(String, ForeignKey("places.id"), nullable=True)
    end_hotel_travel_json = Column(String, nullable=True)  # JSON-encoded TravelSegment back to the end hotel

    trip = relationship("Trip", back_populates="days")
    items = relationship("TripItem", back_populates="day")

class TripItem(Base):
    """
    Represents a specific destination visit within a TripDay.
    Maintains the user-configured duration, sequence ordering, and locked arrival times.
    """
    __tablename__ = "trip_items"
    id = Column(String, primary_key=True, default=generate_uuid)
    day_id = Column(String, ForeignKey("trip_days.id"))
    place_id = Column(String, ForeignKey("places.id"))
    sort_order = Column(Integer)
    user_duration = Column(Integer)
    locked_arrival_time = Column(String, nullable=True)
    travel_data_json = Column(String, nullable=True)  # JSON-encoded TravelSegment from previous place

    day = relationship("TripDay", back_populates="items")

class RouteCache(Base):
    """
    Stores raw JSON responses from the Google Routes API v2.
    Used to implement BR-1 Time-to-Live (TTL) algorithmic caching based on origin,
    destination, and travel mode/preference.
    """
    __tablename__ = "route_cache"
    id = Column(String, primary_key=True, default=generate_uuid)
    origin_id = Column(String, index=True)
    dest_id = Column(String, index=True)
    mode = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    data_json = Column(String) # Storing JSON as text string

class EventLog(Base):
    """
    A lightweight time-series table for logging system metrics and user actions.
    Tracks events such as `trip_synced`, `place_added`, and `route_calculated`.
    """
    __tablename__ = "event_logs"
    id = Column(String, primary_key=True, default=generate_uuid)
    event_type = Column(String)
    data_json = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Expense(Base):
    """
    Tracks budget and expenses for a trip.
    """
    __tablename__ = "expenses"
    id = Column(String, primary_key=True, default=generate_uuid)
    trip_id = Column(String, ForeignKey("trips.id"))
    title = Column(String)
    amount = Column(Float)
    currency = Column(String, default="USD")
    category = Column(String) # e.g. 'Flights', 'Lodging', 'Food', 'Activities', 'Other'
    created_at = Column(DateTime, default=datetime.utcnow)

class Flight(Base):
    """
    Tracks flights associated with a trip.
    """
    __tablename__ = "flights"
    id = Column(String, primary_key=True, default=generate_uuid)
    trip_id = Column(String, ForeignKey("trips.id"))
    flight_number = Column(String)
    departure_airport = Column(String)
    arrival_airport = Column(String)
    departure_time = Column(DateTime)
    arrival_time = Column(DateTime)
    confirmation_code = Column(String, nullable=True)
    price = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
