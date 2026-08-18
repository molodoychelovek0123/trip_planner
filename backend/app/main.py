import os
from fastapi import FastAPI
from dotenv import load_dotenv
from starlette.middleware.sessions import SessionMiddleware
from fastapi.middleware.cors import CORSMiddleware

from .database import engine
from . import models
from .routers import (
    importer, expenses, flights, flight_parser,
    auth, places, trips, favorites, share, routes
)

load_dotenv()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(auth.router)
app.include_router(places.router)
app.include_router(trips.router)
app.include_router(favorites.router)
app.include_router(share.router)
app.include_router(routes.router)
app.include_router(importer.router)
app.include_router(expenses.router)
app.include_router(flights.router)
app.include_router(flight_parser.router)

app.add_middleware(SessionMiddleware, secret_key="some-random-string")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
