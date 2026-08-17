# TripPlanner (Full Stack Architecture)

A dynamic, multi-day itinerary planner inspired by the layouts of Google Maps and Wanderlog, with the powerful "smart time" calculation tools seen in JapanTravel. Currently transitioned to a **Stage 2 Architecture** utilizing a Python backend for data persistence and API caching.

## Architecture Documentation

- [Backend Documentation](backend/README.md) - FastAPI, PostgreSQL, API Caching, Alembic Migrations
- [Frontend Documentation](trip-planner/README.md) - React, Vite, Zustand, Tailwind

## Features

* **Algorithmic Caching (BR-1)**: Proxies costly Google Places and Routes API calls through a local backend, caching results in PostgreSQL to minimize API costs.
* **Flexible Time Model (BR-2 & BR-3)**: Times automatically cascade down the schedule when a new location or travel time is added. Users can lock an arrival time to create "Free Time" or receive warnings for delays without breaking the entire itinerary.
* **Offline-First & State Sync (BR-4)**: The React frontend uses Zustand for instant local persistence, while debouncing a background sync to the FastAPI backend.
* **Modern Google Maps Integration**: Uses the Places API (New) and Routes API (v2) directly via custom proxy endpoints, rendering actual street-level polylines dynamically.

## Quick Start Setup

To run the full stack locally, follow these steps.

### 1. Database & Backend Setup
Navigate to the `backend` folder to set up the Python FastAPI server and PostgreSQL database.

```bash
cd backend
# 1. Start Postgres
docker compose up -d
# 2. Setup Python environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# 3. Apply database schemas
alembic upgrade head
# 4. Start the API server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
Navigate to the `trip-planner` folder to run the React UI.

```bash
cd trip-planner
npm install
npm run dev
```

### 3. API Keys
You will need a Google Maps API Key with **Places API (New)** and **Routes API** enabled. Add it to your `backend/.env` file:
```env
VITE_GOOGLE_MAPS_API_KEY=your_key_here
```