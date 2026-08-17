from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
import uuid

router = APIRouter()

class AIChatMessage(BaseModel):
    role: str
    content: str

class AIChatRequest(BaseModel):
    messages: List[AIChatMessage]
    trip_id: Optional[str] = None
    city: Optional[str] = None

class AISuggestedPlace(BaseModel):
    id: str
    name: str
    description: str
    lat: float
    lng: float
    type: str # 'attraction' or 'hotel'

class AIChatResponse(BaseModel):
    text: str
    suggested_places: List[AISuggestedPlace] = []

@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(request: AIChatRequest):
    """
    Mock AI adapter endpoint.
    Parses the last user message to detect intent and returns mocked suggestions.
    This serves as an adapter that can be replaced with a real LLM integration.
    """
    if not request.messages:
        return AIChatResponse(text="Hello! How can I help you plan your trip?")

    last_message = request.messages[-1].content.lower()

    response = AIChatResponse(text="I can help you find attractions and hotels for your trip. Just ask!")

    if "hotel" in last_message:
        response.text = "Here are some great hotels I found for your stay."
        # Generate some mock hotels
        city = request.city or "the city"
        response.suggested_places = [
            AISuggestedPlace(
                id=str(uuid.uuid4()),
                name=f"Grand Plaza Hotel",
                description=f"A luxurious stay in {city} with great amenities.",
                lat=48.8566, # Mock coordinates (Paris)
                lng=2.3522,
                type="hotel"
            ),
            AISuggestedPlace(
                id=str(uuid.uuid4()),
                name=f"Cozy Boutique Inn",
                description=f"A charming boutique hotel perfectly located in {city}.",
                lat=48.8606,
                lng=2.3376,
                type="hotel"
            )
        ]
    elif "add" in last_message or "attraction" in last_message or "place" in last_message:
        response.text = "I've found some highly recommended attractions you should check out!"
        # Generate mock attractions
        city = request.city or "this area"
        response.suggested_places = [
            AISuggestedPlace(
                id=str(uuid.uuid4()),
                name=f"National Art Museum",
                description="Explore centuries of incredible art collections.",
                lat=48.8606, # Louvre approx
                lng=2.3376,
                type="attraction"
            ),
            AISuggestedPlace(
                id=str(uuid.uuid4()),
                name=f"Historic City Square",
                description=f"The bustling center of {city} with beautiful architecture.",
                lat=48.8529, # Notre Dame approx
                lng=2.3500,
                type="attraction"
            ),
            AISuggestedPlace(
                id=str(uuid.uuid4()),
                name=f"Riverside Park",
                description="A relaxing green space perfect for an afternoon stroll.",
                lat=48.8584, # Eiffel Tower approx
                lng=2.2945,
                type="attraction"
            )
        ]

    return response
