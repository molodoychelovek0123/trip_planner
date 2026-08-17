# Stage 3: Auth, Multi-Trip Management & Shareable Links

This document outlines the next phase of TripPlanner development. The foundation (FastAPI + PostgreSQL + React + Zustand) is in place, but the app currently relies on `localStorage`-backed persistence with a **mock user** (`test-user-id`). The goal of this stage is to move to a **fully server-backed state**, introduce **Google OAuth authentication**, provide a **multi-trip dashboard**, and make **every trip addressable via its own shareable URL**.

---

## Objectives

1.  **Real Authentication**: Replace the mock user with Google OAuth 2.0 (Sign in with Google), issuing JWT tokens to the frontend.
2.  **Multi-Trip Management**: Provide a user dashboard listing all trips with create/duplicate/delete capabilities.
3.  **Shareable Trip Links**: Each trip gets its own public + private URL (e.g. `/trip/{trip_id}` and `/trip/{trip_id}/share`), enabling collaboration and view-only sharing.
4.  **Server-Driven State**: Migrate the frontend state away from `localStorage` as the source of truth. The backend DB becomes canonical, with the frontend syncing via an API (with optimistic updates + debounce).
5.  **Keep BR-1 to BR-5 intact**: All algorithmic caching, soft time constraints, graceful degradation, offline-first caching, and low-friction onboarding must continue to work in the new architecture.

---

## 1. Backend: Authentication & User Model

### 1.1 Add Google OAuth
- Use **Authlib** (`authlib` Python package) or **python-jose** + **google-auth** to implement the OAuth 2.0 Authorization Code flow with PKCE.
- Endpoints:
  - `GET /api/auth/google/url` → returns the Google OAuth consent URL (scopes: `openid`, `email`, `profile`).
  - `GET /api/auth/google/callback` → exchanges the auth code for tokens, verifies the ID token, and creates/finds the user in the `users` table.
  - `POST /api/auth/refresh` → issues a new access token from a refresh token (optional, for long-lived sessions).
- **Session Strategy**: Issue a **JWT access token** (short-lived, e.g. 15 min) + store user profile in the frontend. For simplicity in early stages, a single long-lived JWT (e.g. 30 days) is acceptable.
- **Required new dependency**: `authlib` (or `google-auth` + `jose`).

### 1.2 Update the `users` table schema
Add fields to support Google OAuth identity:
- `google_sub` (String, unique, index) — Google subject identifier.
- `name` (String, nullable) — display name from Google profile.
- `picture_url` (String, nullable) — avatar URL.
- `access_token` / `refresh_token` (encrypted) — *optional, only if we need to call Google APIs on behalf of the user* (e.g. importing Google Maps lists).

Run a new Alembic migration: `alembic revision --autogenerate -m "add_google_auth_fields"`.

### 1.3 `GET /api/auth/me` endpoint
Return the current user's profile based on the validated JWT. The frontend calls this on app load to restore the session.

---

## 2. Backend: Trip Ownership & CRUD

### 2.1 Ownership checks
All trip endpoints must now **require authentication** and enforce `trip.user_id == current_user.id` (or validate a `viewer` role for public share links).

### 2.2 Trip CRUD endpoints
- `GET /api/trips` → list all trips of the authenticated user (id, title, created_at, cover thumbnail if any).
- `POST /api/trips` → create a new empty trip, returns `{ id, title }`.
- `GET /api/trips/{trip_id}` → fetch a full trip (days + items + places). Requires ownership OR a valid public share token.
- `PATCH /api/trips/{trip_id}` → full state sync (same as today, but now **requires auth** and validates ownership). Replace the mock `test-user-id` with `request.user.id`.
- `DELETE /api/trips/{trip_id}` → delete a trip and all its dependent days/items.
- `POST /api/trips/{trip_id}/duplicate` → clone a trip (copy days and items with new UUIDs).

### 2.3 Share / Public access
- `POST /api/trips/{trip_id}/share` → toggles `is_public` and returns/updates a **share token** (unique random string) if public.
- `GET /api/share/{share_token}` → public, read-only access to a trip. Does NOT require auth. Used for the view-only share URL.
- Add a `share_token` column (String, unique, nullable) to the `trips` table via Alembic migration.

---

## 3. Frontend: Routing & New Screens

Currently the app is a single-screen SPA (`App.tsx` with Sidebar + MapView). We need to introduce **React Router** and several new views.

### 3.1 Add `react-router-dom`
Add a new dependency and a basic route tree:

| Route | Screen | Auth required | Purpose |
|-------|--------|---------------|---------|
| `/` | Auth Landing / Login | No | Landing page with "Sign in with Google" button, product pitch, hero. |
| `/dashboard` | Trip Dashboard | Yes | List of user's trips, create/duplicate/delete buttons. |
| `/trip/:tripId` | Trip Editor | Yes (owner) | The current multi-day planning UI (Sidebar + MapView). |
| `/share/:shareToken` | Shared Trip (Read-only) | No | View a public trip read-only (no editing). |

### 3.2 Screen: Auth Landing (`/`)
- Full-screen landing page with product branding and "Sign in with Google" button.
- On click → call `GET /api/auth/google/url`, redirect the browser to the returned URL.
- After Google redirects back to `/api/auth/google/callback`, the backend sets a JWT cookie (or returns it via redirect query param) and redirects to `/dashboard`.
- If a user is already authenticated (valid token in storage/cookie), redirect them straight to `/dashboard`.

### 3.3 Screen: Trip Dashboard (`/dashboard`)
- Fetch `GET /api/trips` on mount.
- Render a responsive grid of trip "cards" (title, created date, item count).
- Buttons: **New Trip**, **Duplicate**, **Delete** (with confirmation).
- Empty state: friendly call-to-action to create the first trip.

### 3.4 Screen: Trip Editor (`/trip/:tripId`)
- This is the current `App.tsx` layout. Refactor to read `:tripId` from the URL and load that trip's state via `GET /api/trips/{trip_id}` on mount.
- If the user is not the owner (e.g. navigating to a private trip they don't own), show a 403 error screen.

### 3.5 Screen: Shared Trip (`/share/:shareToken`)
- Read-only mode. Render the itinerary without editing controls (no add/remove/reorder, no hotel selection).
- Show a "View-only" banner. Provide a header with the trip title and a "Copy link" button.
- This screen only fetches `GET /api/share/{share_token}` — no auth required.

---

## 4. Frontend State Management Refactor

### 4.1 Remove the mock `MOCK_TRIP_ID` and hardcoded `localStorage` source of truth
In `store.ts`, the persistence layer currently writes to `localStorage` immediately and does a debounced `PATCH /api/trips/default-trip-id`. This must change:

1.  **Session restore**: On app load, call `GET /api/auth/me`. If a valid user exists:
    - Fetch their dashboard via `GET /api/trips`.
    - If a `:tripId` is present in the URL, load `GET /api/trips/{trip_id}`.
2.  **Optimistic local cache**: Keep `localStorage` as a **cache only** (for offline-first BR-4), but the backend becomes the source of truth. The `persist` middleware should:
    - Read from `localStorage` for instant first paint (offline-first).
    - Reconcile with server state once the API responds.
3.  **Per-trip namespacing**: Change the Zustand storage key from a single global `trip-planner-storage` to `trip-planner-storage:{tripId}` so multiple trips don't clobber each other.
4.  **Auth-aware sync**: The `PATCH /api/trips/{trip_id}` sync must include a valid `Authorization: Bearer <token>` header. Handle `401` responses by redirecting to `/`.

### 4.2 Refactor `store.ts` structure
Split the single Zustand store into logical slices (or keep one store but add auth/trip-meta fields):
- `authSlice`: `{ user, token, isAuthenticated, login(), logout() }`.
- `tripSlice` (existing): `{ triplist, days, activeDayId, ... }` — now scoped to `tripId`.
- `dashboardSlice` (optional): `{ trips: TripMeta[], fetchTrips(), createTrip(), deleteTrip() }`.

### 4.3 Offline-first (BR-4) preservation
- Keep the debounced `localStorage` write so the UI works instantly on reload.
- When the device is offline, queue sync events; flush them to the server when connectivity returns (a simple `beforeunload`/`online` listener).
- Cache the Google Routes polylines and place details locally (per trip) so the planner remains viewable in airplane mode.

---

## 5. Onboarding: Google Maps List Import (BR-5)

### 5.1 Add "Import from Google Maps" flow
- On the Trip Editor, add an "Import" button.
- User pastes a *share link* from a Google Maps list (e.g. `https://maps.app.goo.gl/...` or `https://www.google.com/maps/.../list/...`), or free text.
- Backend endpoint: `POST /api/import/gmaps-list` → parses the link, resolves place IDs, geocodes free text, dedupes, and returns a list of `Place` objects for the user to add to the triplist.

### 5.2 Geocoding endpoint
- `POST /api/geocode` → takes a free-text query, uses Google Geocoding API (or Places API Text Search), caches results into the `places` table (following BR-1), and returns matches.

---

## 6. Security & Configuration

### 6.1 Backend env additions (`.env.example`)
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
JWT_SECRET=...
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080  # 7 days for MVP
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
```

### 6.2 Frontend env additions (`trip-planner/.env.example`)
```
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_OAUTH_REDIRECT=/api/auth/google
```

### 6.3 CORS
Update the FastAPI `CORSMiddleware` to only allow `FRONTEND_URL` (not `*`). Add `Authorization` to allowed headers.

---

## 7. Data Migration & Schema Updates

Run the following Alembic migrations in order:
1. `add_google_auth_fields` → adds `google_sub`, `name`, `picture_url` to `users`.
2. `add_share_token_to_trips` → adds `share_token` (unique, nullable) to `trips`.
3. (Optional) `add_trip_item_count_index` → add an index on `trips.user_id` for fast dashboard queries.

---

## 8. Testing Strategy

### 8.1 Backend tests (pytest)
- **Auth**: Google OAuth callback flow (mock Google token endpoint), JWT issuance & validation.
- **Trip ownership**: Verify a user cannot `PATCH`/`DELETE` another user's trip.
- **Share links**: Public token access works without auth; invalid token → 404.
- **CRUD**: Create, read, update, delete, duplicate round-trips.

### 8.2 Frontend tests (Vitest + Testing Library)
- **Auth landing**: Renders "Sign in with Google"; redirects authenticated users to `/dashboard`.
- **Dashboard**: Loads trips, renders cards, handles empty state.
- **Trip editor**: Loads a trip from the URL param; unauthenticated → redirect to `/`.
- **Shared view**: Renders read-only, no edit controls.

---

## 9. Implementation Order (Simplified Roadmap)

1.  **Backend auth foundation**
    - Add `authlib`, `python-jose` or `google-auth` to `requirements.txt`.
    - Implement `/api/auth/google/url`, `/api/auth/google/callback`, `/api/auth/me`.
    - Write Alembic migrations for `users` new fields.
2.  **Backend trip ownership**
    - Add `Depends(get_current_user)` to all `/api/trips*` routes; replace mock user.
    - Add share token column + `/api/share/{token}` endpoint.
3.  **Frontend auth plumbing**
    - Add `react-router-dom`; create the route tree.
    - Create `AuthContext`/`authSlice` in Zustand; persist JWT securely.
    - Build the Auth Landing screen with Google Sign-In.
4.  **Frontend dashboard**
    - Build `/dashboard` screen (trip list + create/duplicate/delete).
5.  **State migration**
    - Refactor `store.ts` to per-trip storage keys and auth-aware sync.
    - Rewire the Trip Editor to load state from the URL `:tripId`.
6.  **Shareable links**
    - Build the `/share/:shareToken` read-only screen.
    - Add "Copy link" button to the Trip Editor header.
7.  **Onboarding import (BR-5)**
    - Add Google Maps list import + free-text geocoding endpoints and UI.
8.  **Offline polish (BR-4)**
    - Add `beforeunload`/`online` sync flush and per-trip local cache validation.
9.  **Deploy considerations**
    - Containerize the backend (Dockerfile), configure DB migrations in CI/CD.
    - Setup OAuth credentials for production domain (client ID, secret, redirect URI).
    - Add HTTPS (required for Google OAuth consent screen).

---

## 10. Acceptance Criteria

- [ ] A user can sign in with Google from the landing page and is redirected to `/dashboard`.
- [ ] The dashboard lists all their trips; creating, duplicating, and deleting trips works and persists to PostgreSQL.
- [ ] Navigating to `/trip/{tripId}` loads that trip's full itinerary from the server (not from shared `localStorage`).
- [ ] Two different users cannot edit each other's trips (401/403 enforced server-side).
- [ ] A trip can be marked public, generating a `/share/{token}` URL that renders read-only without login.
- [ ] The frontend sync debounce sends `Authorization` headers and handles `401` by redirecting to `/`.
- [ ] Offline mode still renders the last-viewed itinerary from `localStorage` cache.
- [ ] Importing a Google Maps list link or pasted text adds places to the triplist without manual entry.
- [ ] Existing BR-1 (algorithmic caching) metrics still hold — cache-hit rate is tracked via `event_logs`.

---

## Notes & Dependencies to Add

| Package | Where | Purpose |
|---------|-------|---------|
| `authlib` | backend | Google OAuth 2.0 flow |
| `python-jose` or `PyJWT` | backend | JWT encode/decode |
| `react-router-dom` | frontend | Client-side routing for new screens |
| `@react-oauth/google` or `@react-oauth/auth` | frontend | (Optional) Google identity SDK on the client |