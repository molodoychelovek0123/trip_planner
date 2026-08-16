import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  defaultDuration: number; // in minutes
}

export interface TravelSegment {
  durationMinutes: number; // calculated travel time from the previous point
  mode: 'DRIVING' | 'WALKING' | 'TRANSIT';
}

export interface DayPlanPlace extends Place {
  travelFromPrevious?: TravelSegment;
}

interface TripState {
  triplist: Place[];
  dayPlan: DayPlanPlace[];
  dayStartTime: string; // HH:MM format, default "09:00"

  // Actions
  setDayStartTime: (time: string) => void;
  addToTriplist: (place: Place) => void;
  removeFromTriplist: (id: string) => void;
  addToDayPlan: (place: Place) => void;
  removeFromDayPlan: (id: string) => void;
  reorderDayPlan: (newPlan: DayPlanPlace[]) => void;
  updatePlaceDuration: (id: string, duration: number) => void;
  updateTravelSegment: (id: string, segment: TravelSegment | undefined) => void;
}

export const useTripStore = create<TripState>()(
  persist(
    (set) => ({
      triplist: [],
      dayPlan: [],
      dayStartTime: "09:00",

      setDayStartTime: (time) => set({ dayStartTime: time }),

      addToTriplist: (place) => set((state) => {
        if (state.triplist.find(p => p.id === place.id)) return state;
        return { triplist: [...state.triplist, place] };
      }),

      removeFromTriplist: (id) => set((state) => ({
        triplist: state.triplist.filter(p => p.id !== id),
        // If we remove from triplist, we might also want to keep it in dayPlan or remove it.
        // We'll leave it in dayPlan since they are separate arrays.
      })),

      addToDayPlan: (place) => set((state) => {
        // Find if it's already there
        if (state.dayPlan.find(p => p.id === place.id)) return state;
        return { dayPlan: [...state.dayPlan, { ...place }] };
      }),

      removeFromDayPlan: (id) => set((state) => {
        const newDayPlan = state.dayPlan.filter(p => p.id !== id);
        // If the first item was removed or an item was removed, we might need to clear the travel segment of the new next item.
        // Actually, let's keep it simple: just remove it. Recalculation will handle travel times.
        if (newDayPlan.length > 0) {
          // If the item removed was not the last one, the next item's travel segment might be invalid now.
          // We can clear it to force recalculation.
          const removedIndex = state.dayPlan.findIndex(p => p.id === id);
          if (removedIndex >= 0 && removedIndex < state.dayPlan.length - 1) {
             newDayPlan[removedIndex] = { ...newDayPlan[removedIndex], travelFromPrevious: undefined };
          }
        }
        return { dayPlan: newDayPlan };
      }),

      reorderDayPlan: (newPlan) => set({ dayPlan: newPlan }),

      updatePlaceDuration: (id, duration) => set((state) => {
        // Update in triplist
        const newTriplist = state.triplist.map(p => p.id === id ? { ...p, defaultDuration: duration } : p);
        // Update in dayPlan
        const newDayPlan = state.dayPlan.map(p => p.id === id ? { ...p, defaultDuration: duration } : p);

        return { triplist: newTriplist, dayPlan: newDayPlan };
      }),

      updateTravelSegment: (id, segment) => set((state) => {
        const newDayPlan = state.dayPlan.map(p =>
          p.id === id ? { ...p, travelFromPrevious: segment } : p
        );
        return { dayPlan: newDayPlan };
      })
    }),
    {
      name: 'trip-planner-storage', // name of item in localStorage
    }
  )
)
