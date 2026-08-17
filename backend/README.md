# TripPlanner Backend (FastAPI + PostgreSQL)

This directory contains the backend for the TripPlanner application (Stage 2 Architecture). It is built with Python, FastAPI, and PostgreSQL to handle API caching, metrics logging, and data persistence for user trips.

## Prerequisites

- **Python 3.11+**
- **PostgreSQL 15+** (Running locally or via Docker)
- **Google Maps API Key** (with Places API New and Routes API v2 enabled)

## Setup Instructions

### 1. Database Setup

You can run PostgreSQL via Docker or natively on your machine.

**Option A: Using Docker (Recommended)**
```bash
docker compose up -d
```
*This will spin up a PostgreSQL instance on port 5432 with user `planner` and database `trip_planner`.*

**Option B: Native PostgreSQL**
Ensure PostgreSQL is running and execute:
```sql
CREATE USER planner WITH PASSWORD 'planner_password';
CREATE DATABASE trip_planner OWNER planner;
```

### 2. Python Environment Setup

Navigate to the `backend` directory and set up a virtual environment:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
```

Install the dependencies:
```bash
pip install -r requirements.txt
```

### 3. Environment Variables

Create a `.env` file in the `backend` directory:
```bash
cp .env.example .env
```
Open `.env` and configure your API key:
```env
VITE_GOOGLE_MAPS_API_KEY=your_real_google_maps_api_key_here
```

### 4. Database Migrations

Initialize the database schema using Alembic:
```bash
alembic upgrade head
```
*This command creates the necessary tables (`users`, `places`, `trips`, `trip_days`, `trip_items`, `route_cache`, `event_logs`).*

### 5. Start the Server

Run the FastAPI development server:
```bash
uvicorn app.main:app --reload --port 8000
```
The API will be available at `http://127.0.0.1:8000`. You can view the interactive Swagger API documentation at `http://127.0.0.1:8000/docs`.

---

## System Architecture

* **Caching Proxy**: To satisfy Business Requirement 1 (BR-1: Cost Management), this backend acts as a proxy for the Google Maps API.
  * **Places**: Queries to `/api/places/{place_id}` first check the local PostgreSQL database (`places` table). If the place exists, it is served from the database (cache hit). If not, it fetches from Google, saves it to the DB, and returns it.
  * **Routes**: Queries to `/api/routes/compute` generate a cache key based on travel mode and routing preference. Valid cached routes are served from the `route_cache` table (with a 24-hour TTL).
* **State Synchronization**: The frontend uses a custom Zustand storage engine to `PATCH` the user's current trip state to `/api/trips/{trip_id}`. This keeps the local device and cloud database in sync, fulfilling the groundwork for cross-device sharing.