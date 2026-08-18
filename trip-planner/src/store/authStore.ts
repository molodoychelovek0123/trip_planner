import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthState } from '../types'

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
