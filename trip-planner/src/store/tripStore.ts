import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PersistStorage } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { Place, DayData, DayPlanPlace, TripState } from '../types';
import { useAuthStore } from './authStore'

const defaultPlaces: Place[] = [
  { id: 'eiffel', name: 'Eiffel Tower', lat: 48.8584, lng: 2.2945, recommendedDuration: 30, city: 'Paris' },
  { id: 'louvre', name: 'Louvre Museum', lat: 48.8606, lng: 2.3376, recommendedDuration: 30, city: 'Paris' },
  { id: 'notredame', name: 'Notre-Dame Cathedral', lat: 48.8529, lng: 2.3500, recommendedDuration: 30, city: 'Paris' },
  { id: 'arcdetriomphe', name: 'Arc de Triomphe', lat: 48.8738, lng: 2.2950, recommendedDuration: 30, city: 'Paris' }
];

export const useTripStore = create<TripState>()(
  persist(
    (set) => ({
      triplist: defaultPlaces,
      days: [{ id: uuidv4(), startTime: '09:00', plan: [], flights: [] }],
      activeDayId: null,
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
        const days = (serverState.days && serverState.days.length > 0)
            ? serverState.days
            : [{ id: uuidv4(), startTime: '09:00', plan: [], flights: [] }];

        const localDayLookup = new Map<string, DayData>();
        for (const d of (state.days || [])) {
          if (d && typeof d.id === 'string') {
            localDayLookup.set(d.id, d);
          }
        }

        const triplistLookup = new Map<string, Place>();
        for (const place of (serverState.triplist || [])) {
          if (place && typeof place.id === 'string') {
            triplistLookup.set(place.id, place);
          }
        }

        const enrichedDays = days.map(day => {
          if (!day || typeof day.id !== 'string') return day;
          const localDay = localDayLookup.get(day.id);

          const startHotelId = typeof (day as DayData).startHotelId === 'string'
            ? (day as DayData).startHotelId
            : (day as any).startHotel?.id;
          const endHotelId = typeof (day as DayData).endHotelId === 'string'
            ? (day as DayData).endHotelId
            : (day as any).endHotel?.id;

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
      name: 'trip-planner-storage',
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

            localStorage.setItem(key, JSON.stringify(value));

            if (!tripId || !token) return;

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
                      useAuthStore.getState().logout();
                      sessionStorage.setItem('sessionExpired', 'true');
                      window.location.href = '/';
                  }
              })
              .catch(err => console.error("Failed to sync state to backend:", err));
            }, 1000);
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
