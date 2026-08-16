# Stage 2: Backend Architecture & Scaling

This document outlines the architectural plan for transitioning the TripPlanner from a pure-frontend Proof of Concept (Stage 1) to a full-stack, scalable application (Stage 2).

## Core Objectives for Stage 2
1.  **Persistence & Sharing**: Store user data securely in a database, allowing cross-device synchronization and public link sharing (e.g., `tripplanner.com/trip/123`).
2.  **API Cost Optimization (Caching)**: Shift Google Maps API calls from the client to the backend to implement global caching.
3.  **Metrics & Analytics**: Track usage patterns (routes optimized, places added) to inform future business decisions.
4.  **AI Integration Prep**: Lay the groundwork for a Python backend that can interface with LLMs for smart duration recommendations.

---

## 1. Tech Stack (Backend)
To support rapid development, data science/AI integration, and scalability:
*   **Language & Framework**: **Python 3.11+** with **FastAPI**. FastAPI provides async support, fast execution, and automatic OpenAPI (Swagger) documentation, which makes frontend integration seamless.
*   **Database**: **PostgreSQL**. A robust relational database is ideal for structured trip data and spatial queries (PostGIS can be added later if complex geo-queries are needed).
*   **ORM**: **SQLAlchemy 2.0** or **SQLModel** for database interactions.
*   **Auth**: **Supabase** or **Auth0** for simple JWT-based authentication (Google/Telegram login).

---

## 2. Database Schema (PostgreSQL)

To prevent duplicate API calls, we will implement a Global Places Cache. If User A searches for "Eiffel Tower", we save the coordinates and details to our DB. When User B searches for it, we serve it from our DB, costing $0 in Google API fees.

### `users`
*   `id` (UUID, PK)
*   `email` (String)
*   `created_at` (Timestamp)

### `places` (Global Cache)
*   `id` (UUID, PK)
*   `google_place_id` (String, Unique Index)
*   `name` (String)
*   `lat` (Float)
*   `lng` (Float)
*   `recommended_duration` (Int) - *Can be updated later via AI agent*
*   `created_at` (Timestamp)

### `trips`
*   `id` (UUID, PK)
*   `user_id` (UUID, FK -> users.id)
*   `title` (String)
*   `is_public` (Boolean, default: False)
*   `created_at` (Timestamp)

### `trip_days`
*   `id` (UUID, PK)
*   `trip_id` (UUID, FK -> trips.id)
*   `day_index` (Int)
*   `start_time` (String)
*   `start_hotel_place_id` (UUID, FK -> places.id, Nullable)
*   `end_hotel_place_id` (UUID, FK -> places.id, Nullable)

### `trip_items` (The Timeline)
*   `id` (UUID, PK)
*   `day_id` (UUID, FK -> trip_days.id)
*   `place_id` (UUID, FK -> places.id)
*   `sort_order` (Int)
*   `user_duration` (Int)
*   `locked_arrival_time` (String, Nullable)

---

## 3. Backend Services & Logic

### A. The Geocoding Proxy Service
The frontend will no longer call `https://places.googleapis.com` directly.
Instead, it calls `GET /api/places/search?q=Eiffel`.
1. The FastAPI backend queries the local PostgreSQL `places` table using text similarity.
2. If found, return instantly.
3. If not found, backend calls Google Places API, saves the result to PostgreSQL, and returns it.

### B. The Routing Cache Service
Similarly, `computeRoutes` can be cached based on an origin-destination hash. However, because transit times change dynamically based on time of day, we must cache with a TTL (Time To Live, e.g., 24 hours).
*   *Table:* `route_cache (origin_id, dest_id, mode, timestamp, data_json)`

---

## 4. Metrics & Analytics

To understand product-market fit, we will track business metrics. We can use a lightweight time-series DB (like ClickHouse) or simply emit structured JSON logs to Datadog/BigQuery.

**Key Events to Track:**
*   `trip_created`: When a user starts a new trip.
*   `place_added`: When a user adds a place to their Triplist.
*   `route_calculated`: When the routing API is invoked.
*   `day_optimized`: When a user reorders items or shifts their schedule.

**Business Dashboards to Build:**
*   *Average Places per Trip*: Are users planning 2 locations or 15?
*   *API Cache Hit Rate*: What percentage of `place_added` events were served from our DB vs Google? (Target: > 70%).
*   *Session Length*: How long does it take a user to assemble a Day Plan?

---

## 5. Migration Strategy
1.  **Init Backend Repo**: Setup FastAPI and Docker/Docker Compose for local development.
2.  **Define Models & Migrations**: Setup Alembic for PostgreSQL migrations.
3.  **Proxy APIs**: Write the FastAPI routes that proxy Google Maps requests and build the cache logic.
4.  **Frontend Auth**: Implement JWT handling in the React app.
5.  **State Sync**: Modify the Zustand `persist` middleware. Instead of syncing strictly to `localStorage`, build a custom storage engine that debounces state changes and performs `PATCH /api/trips/{id}` requests to sync the state to the cloud.