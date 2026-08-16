import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

export interface Place {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  recommendedDuration: number; // in minutes
}

export interface TransitBadge {
  vehicleType: string;
  shortName: string;
  color: string;
  textColor: string;
}

export interface RouteStep {
  travelMode: string; // 'WALK', 'TRANSIT', 'DRIVE'
  encodedPolyline: string;
  color?: string; // Used for transit lines, default to gray for walk, blue for drive
}

export interface RouteAlternative {
  durationMinutes: number;
  summary: string;
  steps: RouteStep[];
  transitBadges?: TransitBadge[];
}

export interface TravelSegment {
  durationMinutes: number; // dynamically matches the selected alternative
  mode: 'DRIVING' | 'WALKING' | 'TRANSIT';
  routeAlternatives?: RouteAlternative[];
  selectedRouteIndex?: number;
}

export interface DayPlanPlace extends Place {
  userDuration: number;
  travelFromPrevious?: TravelSegment;
  uniqueId: string; // Unique ID for drag and drop since the same place can potentially be added multiple times
  lockedArrivalTime?: string; // HH:MM format if the user explicitly sets an arrival time
}

export interface DayData {
  id: string;
  startTime: string; // HH:MM format, default "09:00"
  plan: DayPlanPlace[];
  startHotelId?: string; // ID of the place in Triplist used as start hotel
  endHotelId?: string;   // ID of the place in Triplist used as end hotel
  endHotelTravel?: TravelSegment; // Route from the last plan point to the end hotel
}

const defaultPlaces: Place[] = [
  { id: 'eiffel', name: 'Eiffel Tower', lat: 48.8584, lng: 2.2945, recommendedDuration: 30 },
  { id: 'louvre', name: 'Louvre Museum', lat: 48.8606, lng: 2.3376, recommendedDuration: 30 },
  { id: 'notredame', name: 'Notre-Dame Cathedral', lat: 48.8529, lng: 2.3500, recommendedDuration: 30 },
  { id: 'arcdetriomphe', name: 'Arc de Triomphe', lat: 48.8738, lng: 2.2950, recommendedDuration: 30 }
];

interface TripState {
  triplist: Place[];
  days: DayData[];
  activeDayId: string | null;

  // App Actions
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
}

export const useTripStore = create<TripState>()(
  persist(
    (set) => ({
      triplist: defaultPlaces,
      days: [{ id: 'day-1', startTime: '09:00', plan: [] }],
      activeDayId: 'day-1',

      setActiveDay: (dayId) => set({ activeDayId: dayId }),

      addDay: () => set((state) => {
        const newDayId = `day-${state.days.length + 1}`;
        return {
          days: [...state.days, { id: newDayId, startTime: '09:00', plan: [] }],
          activeDayId: newDayId
        };
      }),

      removeDay: (dayId) => set((state) => {
        const newDays = state.days.filter(d => d.id !== dayId);
        if (newDays.length === 0) {
          // Keep at least one day
          return { days: [{ id: 'day-1', startTime: '09:00', plan: [] }], activeDayId: 'day-1' };
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
      }))
    }),
    {
      name: 'trip-planner-storage', // name of item in localStorage
    }
  )
)
