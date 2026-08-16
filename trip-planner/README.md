# TripPlanner - Stage 1 (Proof of Concept)

A pure frontend Proof of Concept for a dynamic, multi-day itinerary planner, inspired by the layouts of Google Maps and Wanderlog, with the powerful "smart time" calculation tools seen in JapanTravel.

## Features (Pure Frontend)

*   **Offline-First & Local Persistence**: State is managed via `Zustand` and synced to `localStorage`, allowing the app to reload instantly without losing the user's drafted plan.
*   **Modern Google Maps Integration**:
    *   Replaces deprecated legacy SDKs by utilizing `fetch` requests directly to the **Places API (New)** and **Routes API (v2)**.
    *   Decodes and renders actual street-level polylines (`google.maps.geometry.encoding`).
    *   Distinguishes between transit modes dynamically (rendering dotted lines for walking segments, solid colored lines for public transit).
*   **Rich Transit UX**: Generates detailed, colored badges with native emojis (🚇, 🚌, 🚋) for alternative transit routes rather than generic options.
*   **Smart Time Cascading & Locking**:
    *   Times automatically cascade down the schedule when a new location or travel time is added.
    *   Users can "lock" an arrival time (e.g., for a booked tour). If they arrive early, the system generates a **Free Time** block. If they arrive late, the system alerts them with a **Warning**, without aggressively shifting the rest of the fixed itinerary.
*   **Multi-Day & Hotel Anchors**:
    *   Users can switch between multiple days, dragging and dropping locations via `@dnd-kit`.
    *   Start and End hotels can be set for each day, properly routing the first and last trips.
*   **Smart Suggestions**: Calculates Haversine distances strictly on the client side to suggest the closest saved places, avoiding costly API calls.

## Tech Stack

*   **React + Vite** (Fast build, modern tooling)
*   **TypeScript** (Strict typing for complex state)
*   **Zustand** (Lightweight state management & persistence)
*   **Tailwind CSS** (Rapid, responsive styling)
*   **@dnd-kit** (Headless, accessible drag-and-drop)
*   **Google Maps JS API Loader** (Dynamic script injection)

## Setup

1.  Clone the repository and install dependencies:
    ```bash
    npm install
    ```
2.  Set up your Google Maps API key. Create a `.env` file in the root:
    ```env
    VITE_GOOGLE_MAPS_API_KEY="your_api_key_here"
    ```
    *Ensure your API key has Places API (New) and Routes API enabled in the Google Cloud Console.*
3.  Start the development server:
    ```bash
    npm run dev
    ```

## Moving Forward
Read `NEXT_STEPS.md` to see the architectural plan for Stage 2 (Backend, Database, and Metrics).