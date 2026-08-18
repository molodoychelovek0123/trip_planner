/**
 * @fileoverview Central state management using Zustand for the TripPlanner application.
 * Handles persistence to localStorage, multi-day itinerary management, and the saved places pool (Triplist).
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PersistStorage } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

export interface AuthState {
  token: string | null;
  activeTripId: string | null;
  setToken: (token: string | null) => void;
  setActiveTripId: (tripId: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      activeTripId: null,
      setToken: (token) => set({ token }),
      setActiveTripId: (tripId) => set({ activeTripId: tripId }),
      logout: () => set({ token: null, activeTripId: null }),
    }),
    {
      name: 'trip-planner-auth',
    }
  )
)

/**
 * Represents a saved geographical location.
 */
export interface Place {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  recommendedDuration: number; // in minutes
  city?: string; // e.g. "Paris"
}

/**
 * Visual badge data for rendering specific transit vehicles (e.g., Metro lines).
 */
export interface TransitBadge {
  vehicleType: string;
  shortName: string;
  color: string;
  textColor: string;
}

/**
 * A single geographical step of a route, containing its mode and encoded path.
 */
export interface RouteStep {
  travelMode: string; // 'WALK', 'TRANSIT', 'DRIVE'
  encodedPolyline: string;
  color?: string; // Used for transit lines, defaults to gray for walk, blue for drive
}

/**
 * An alternative route option returned by the Google Routes API.
 */
export interface RouteAlternative {
  durationMinutes: number;
  summary: string;
  steps: RouteStep[];
  transitBadges?: TransitBadge[];
}

/**
 * Represents the travel segment bridging the previous location and the current one.
 */
export interface TravelSegment {
  durationMinutes: number; // Dynamically matches the selected alternative
  mode: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'MANUAL';
  routeAlternatives?: RouteAlternative[];
  selectedRouteIndex?: number;
}

export interface FlightDetails {
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime?: string; // HH:MM
  arrivalTime?: string;   // HH:MM
  bufferHours?: number;   // e.g. 2
}

/**
 * Represents a place scheduled within a specific day's itinerary.
 */
export interface DayPlanPlace extends Place {
  type?: 'PLACE' | 'FLIGHT';
  userDuration: number;
  travelFromPrevious?: TravelSegment;
  uniqueId: string; // Unique ID for drag-and-drop (same Place ID can exist multiple times)
  lockedArrivalTime?: string; // HH:MM format if the user explicitly anchors the schedule
  cost?: number;
  currency?: string;
  flightDetails?: FlightDetails;
}

/**
 * Represents a single day in the multi-day trip.
 */
export interface DayData {
  id: string;
  startTime: string; // HH:MM format, defaults to "09:00"
  plan: DayPlanPlace[];
  flights: DayPlanPlace[];
  startHotelId?: string; // ID of the place in Triplist used as the morning origin
  endHotelId?: string;   // ID of the place in Triplist used as the evening destination
  endHotelTravel?: TravelSegment; // Route from the last plan point back to the end hotel
}

const defaultPlaces: Place[] = [
  { id: 'eiffel', name: 'Eiffel Tower', lat: 48.8584, lng: 2.2945, recommendedDuration: 30, city: 'Paris' },
  { id: 'louvre', name: 'Louvre Museum', lat: 48.8606, lng: 2.3376, recommendedDuration: 30, city: 'Paris' },
  { id: 'notredame', name: 'Notre-Dame Cathedral', lat: 48.8529, lng: 2.3500, recommendedDuration: 30, city: 'Paris' },
  { id: 'arcdetriomphe', name: 'Arc de Triomphe', lat: 48.8738, lng: 2.2950, recommendedDuration: 30, city: 'Paris' }
];

interface TripState {
  triplist: Place[];
  days: DayData[];
  activeDayId: string | null;
  userCurrency: string;
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncError: string | null;

  // App Actions
  setDays: (days: DayData[]) => void;
  setUserCurrency: (currency: string) => void;
  setActiveDay: (dayId: string) => void;
  addDay: () => void;
  removeDay: (dayId: string) => void;
  setDayStartTime: (dayId: string, time: string) => void;
  setStartHotel: (dayId: string, hotelId: string | undefined) => void;
  setEndHotel: (dayId: string, hotelId: string | undefined) => void;

  // Triplist Actions
  addToTriplist: (place: Place) => void;
  removeFromTriplist: (id: string) => void;

  // DayPlan Actions
  addToDayPlan: (dayId: string, place: Place) => void;
  removeFromDayPlan: (dayId: string, uniqueId: string) => void;
  reorderDayPlan: (dayId: string, newPlan: DayPlanPlace[]) => void;
  updatePlaceDuration: (dayId: string, uniqueId: string, duration: number) => void;
  updateTravelSegment: (dayId: string, uniqueId: string, segment: TravelSegment | undefined) => void;
  updateEndHotelTravel: (dayId: string, segment: TravelSegment | undefined) => void;
  updateLockedArrivalTime: (dayId: string, uniqueId: string, time: string | undefined) => void;
  updatePlaceCost: (dayId: string, uniqueId: string, cost: number | undefined, currency: string | undefined) => void;
  
  // Flights
  addFlight: (dayId: string, flight: DayPlanPlace) => void;
  removeFlight: (dayId: string, uniqueId: string) => void;
  updateFlightDetails: (dayId: string, uniqueId: string, flightDetails: FlightDetails, name: string, lat: number, lng: number, userDuration: number) => void;
  updateFlightCost: (dayId: string, uniqueId: string, cost: number | undefined, currency: string | undefined) => void;

  initFromServer: (serverState: Partial<TripState>) => void;
}

export const useTripStore = create<TripState>()(
  persist(
    (set) => ({
      triplist: defaultPlaces,
      days: [{ id: uuidv4(), startTime: '09:00', plan: [], flights: [] }],
      activeDayId: null, // Will be set after initial creation or load
      userCurrency: 'USD',
      isSyncing: false,
      lastSyncTime: null,
      syncError: null,

      setDays: (days) => set({ days }),
      setUserCurrency: (currency) => set({ userCurrency: currency }),
      setActiveDay: (dayId) => set({ activeDayId: dayId }),

      addDay: () => set((state) => ({
        days: [...state.days, { id: uuidv4(), startTime: '09:00', plan: [], flights: [] }]
      })),

      removeDay: (dayId) => set((state) => {
        const newDays = state.days.filter(d => d.id !== dayId);
        if (newDays.length === 0) {
          // Keep at least one day
          return { days: [{ id: 'day-1', startTime: '09:00', plan: [], flights: [] }], activeDayId: 'day-1' };
        }
        return {
          days: newDays,
          activeDayId: state.activeDayId === dayId ? newDays[0].id : state.activeDayId
        };
      }),

      setDayStartTime: (dayId, time) => set((state) => ({
        days: state.days.map(d => d.id === dayId ? { ...d, startTime: time } : d)
      })),

      setStartHotel: (dayId, hotelId) => set((state) => ({
        days: state.days.map(d => {
          if (d.id !== dayId) return d;
          // Invalidate first step's travel if hotel changes
          const newPlan = [...d.plan];
          if (newPlan.length > 0) {
            newPlan[0] = { ...newPlan[0], travelFromPrevious: undefined };
          }
          return { ...d, startHotelId: hotelId, plan: newPlan };
        })
      })),

      setEndHotel: (dayId, hotelId) => set((state) => ({
        days: state.days.map(d => d.id === dayId ? { ...d, endHotelId: hotelId, endHotelTravel: undefined } : d)
      })),

      addToTriplist: (place) => set((state) => {
        if (state.triplist.find(p => p.id === place.id)) return state;
        return { triplist: [...state.triplist, place] };
      }),

      removeFromTriplist: (id) => set((state) => ({
        triplist: state.triplist.filter(p => p.id !== id),
      })),

      addToDayPlan: (dayId, place) => set((state) => {
        return {
          days: state.days.map(d => {
            if (d.id !== dayId) return d;
            const newPlace: DayPlanPlace = {
              ...place,
              userDuration: place.recommendedDuration || 30,
              uniqueId: uuidv4()
            };
            return { ...d, plan: [...d.plan, newPlace] };
          })
        };
      }),

      removeFromDayPlan: (dayId, uniqueId) => set((state) => {
        return {
          days: state.days.map(d => {
            if (d.id !== dayId) return d;

            const removedIndex = d.plan.findIndex(p => p.uniqueId === uniqueId);
            const newPlan = d.plan.filter(p => p.uniqueId !== uniqueId);

            if (removedIndex >= 0 && removedIndex < newPlan.length) {
               // Invalidate travel segment of the item that comes after the removed item
               newPlan[removedIndex] = { ...newPlan[removedIndex], travelFromPrevious: undefined };
            }

            return { ...d, plan: newPlan };
          })
        };
      }),

      reorderDayPlan: (dayId, newPlan) => set((state) => ({
        days: state.days.map(d => d.id === dayId ? { ...d, plan: newPlan } : d)
      })),

      updatePlaceDuration: (dayId, uniqueId, duration) => set((state) => ({
        days: state.days.map(d => {
          if (d.id !== dayId) return d;
          return {
            ...d,
            plan: d.plan.map(p => p.uniqueId === uniqueId ? { ...p, userDuration: duration } : p)
          };
        })
      })),

      updatePlaceCost: (dayId, uniqueId, cost, currency) => set((state) => ({
        days: state.days.map(d => d.id === dayId ? {
          ...d,
          plan: d.plan.map(p => p.uniqueId === uniqueId ? { ...p, cost, currency } : p)
        } : d)
      })),

      updateFlightDetails: (dayId, uniqueId, flightDetails, name, lat, lng, userDuration) => set((state) => ({
        days: state.days.map(d => d.id === dayId ? {
          ...d,
          flights: d.flights.map(p => p.uniqueId === uniqueId ? { ...p, flightDetails, name, lat, lng, userDuration, recommendedDuration: userDuration } : p)
        } : d)
      })),
      
      addFlight: (dayId, flight) => set((state) => ({
        days: state.days.map(d => d.id === dayId ? {
          ...d,
          flights: [...(d.flights || []), flight]
        } : d)
      })),

      removeFlight: (dayId, uniqueId) => set((state) => ({
        days: state.days.map(d => d.id === dayId ? {
          ...d,
          flights: d.flights.filter(p => p.uniqueId !== uniqueId)
        } : d)
      })),
      
      updateFlightCost: (dayId, uniqueId, cost, currency) => set((state) => ({
        days: state.days.map(d => d.id === dayId ? {
          ...d,
          flights: d.flights.map(p => p.uniqueId === uniqueId ? { ...p, cost, currency } : p)
        } : d)
      })),

      updateTravelSegment: (dayId, uniqueId, segment) => set((state) => ({
        days: state.days.map(d => {
          if (d.id !== dayId) return d;
          return {
            ...d,
            plan: d.plan.map(p => p.uniqueId === uniqueId ? { ...p, travelFromPrevious: segment } : p)
          };
        })
      })),

      updateEndHotelTravel: (dayId, segment) => set((state) => ({
        days: state.days.map(d => d.id === dayId ? { ...d, endHotelTravel: segment } : d)
      })),

      updateLockedArrivalTime: (dayId, uniqueId, time) => set((state) => ({
        days: state.days.map(d => {
          if (d.id !== dayId) return d;
          return {
            ...d,
            plan: d.plan.map(p => p.uniqueId === uniqueId ? { ...p, lockedArrivalTime: time } : p)
          };
        })
      })),

      initFromServer: (serverState) => set((state) => {
        // Ensure there is always at least one day
        const days = (serverState.days && serverState.days.length > 0)
            ? serverState.days
            : [{ id: uuidv4(), startTime: '09:00', plan: [], flights: [] }];

        // Lookup of existing (localStorage) days by id so we can preserve routes
        // that the server did not return (e.g. old caches or partial payloads).
        const localDayLookup = new Map<string, DayData>();
        for (const d of (state.days || [])) {
          if (d && typeof d.id === 'string') {
            localDayLookup.set(d.id, d);
          }
        }

        // Build a lookup of triplist places by id so we can enrich plan items
        // that may be missing coordinates/name/city (e.g. old cached trips or
        // responses where plan is not fully populated).
        const triplistLookup = new Map<string, Place>();
        for (const place of (serverState.triplist || [])) {
          if (place && typeof place.id === 'string') {
            triplistLookup.set(place.id, place);
          }
        }

        const enrichedDays = days.map(day => {
          if (!day || typeof day.id !== 'string') return day;
          const localDay = localDayLookup.get(day.id);

          // Normalize legacy hotel keys: old payloads used startHotel/endHotel
          // objects, while DayData expects startHotelId/endHotelId strings.
          const startHotelId = typeof (day as DayData).startHotelId === 'string'
            ? (day as DayData).startHotelId
            : (day as any).startHotel?.id;
          const endHotelId = typeof (day as DayData).endHotelId === 'string'
            ? (day as DayData).endHotelId
            : (day as any).endHotel?.id;

          // Preserve the end-hotel route from local state if the server omitted it,
          // or if the server omitted routeAlternatives which we need for drawing polylines.
          const endHotelTravel = (() => {
            const serverTravel = (day as DayData).endHotelTravel;
            const localTravel = localDay?.endHotelTravel;
            if (!serverTravel) return localTravel;
            if (!localTravel) return serverTravel;
            
            if (!serverTravel.routeAlternatives && localTravel.routeAlternatives) {
              return {
                ...serverTravel,
                routeAlternatives: localTravel.routeAlternatives,
                mode: localTravel.mode || serverTravel.mode,
                selectedRouteIndex: localTravel.selectedRouteIndex !== undefined ? localTravel.selectedRouteIndex : serverTravel.selectedRouteIndex
              };
            }
            return serverTravel;
          })();

          if (!Array.isArray((day as DayData).plan)) {
            return {
              ...day,
              startHotelId,
              endHotelId,
              endHotelTravel,
              flights: (day as DayData).flights || []
            } as DayData;
          }

          // Lookup of local (localStorage) plan items by uniqueId to preserve
          // travelFromPrevious routes the server did not return.
          const localItemLookup = new Map<string, DayPlanPlace>();
          if (localDay && Array.isArray(localDay.plan)) {
            for (const lp of localDay.plan) {
              if (lp && typeof lp.uniqueId === 'string') {
                localItemLookup.set(lp.uniqueId, lp);
              }
            }
          }

          return {
            ...day,
            startHotelId,
            endHotelId,
            endHotelTravel,
            flights: (day as DayData).flights || [],
            plan: day.plan.map(item => {
              if (!item || typeof item.id !== 'string') return item;
              const triplistPlace = triplistLookup.get(item.id);
              const localItem = typeof item.uniqueId === 'string' ? localItemLookup.get(item.uniqueId) : undefined;
              return {
                ...item,
                // Preserve the route from local state if the server omitted it,
                // or if the server omitted routeAlternatives which we need for drawing polylines.
                travelFromPrevious: (() => {
                  const serverTravel = item.travelFromPrevious;
                  const localTravel = localItem?.travelFromPrevious;
                  if (!serverTravel) return localTravel;
                  if (!localTravel) return serverTravel;
                  
                  if (!serverTravel.routeAlternatives && localTravel.routeAlternatives) {
                    return {
                      ...serverTravel,
                      routeAlternatives: localTravel.routeAlternatives,
                      mode: localTravel.mode || serverTravel.mode,
                      selectedRouteIndex: localTravel.selectedRouteIndex !== undefined ? localTravel.selectedRouteIndex : serverTravel.selectedRouteIndex
                    };
                  }
                  return serverTravel;
                })(),
                // Fill any missing place metadata from triplist (does not override
                // explicit values already present on the item).
                lat: typeof item.lat === 'number' ? item.lat : (triplistPlace?.lat ?? item.lat),
                lng: typeof item.lng === 'number' ? item.lng : (triplistPlace?.lng ?? item.lng),
                name: item.name ?? triplistPlace?.name,
                city: item.city ?? triplistPlace?.city,
                recommendedDuration: typeof item.recommendedDuration === 'number'
                  ? item.recommendedDuration
                  : (triplistPlace?.recommendedDuration ?? item.recommendedDuration)
              } as DayPlanPlace;
            })
          } as DayData;
        });

        return {
          ...state,
          ...serverState,
          days: enrichedDays,
          activeDayId: serverState.activeDayId || days[0].id
        };
      })
    }),
    {
      name: 'trip-planner-storage', // dynamic key generated in getItem/setItem
      storage: ((): PersistStorage<TripState> => {
        let timeoutId: ReturnType<typeof setTimeout>;

        const getStorageKey = (name: string) => {
          const tripId = useAuthStore.getState().activeTripId;
          return tripId ? `${name}-${tripId}` : name;
        };

        return {
          getItem: (name) => {
            const key = getStorageKey(name);
            const str = localStorage.getItem(key);
            if (!str) return null;
            return JSON.parse(str);
          },
          setItem: (name, value) => {
            const tripId = useAuthStore.getState().activeTripId;
            const token = useAuthStore.getState().token;
            const key = getStorageKey(name);

            // First, update local storage immediately for fast reloads
            localStorage.setItem(key, JSON.stringify(value));

            // Do not sync if there is no active trip ID or token (e.g. shared trip view)
            if (!tripId || !token) return;

            // Then, debounce the sync to the backend
            if (timeoutId) {
              clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(() => {
              fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/trips/${tripId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(value.state)
              })
              .then(res => {
                  if (res.status === 401 || res.status === 403) {
                      // Session expired: clear token, show a UI message and redirect to the auth landing page
                      useAuthStore.getState().logout();
                      sessionStorage.setItem('sessionExpired', 'true');
                      window.location.href = '/';
                  }
              })
              .catch(err => console.error("Failed to sync state to backend:", err));
            }, 1000); // 1-second debounce
          },
          removeItem: (name) => {
              const key = getStorageKey(name);
              localStorage.removeItem(key);
          },
        }
      })(),
    }
  )
)
