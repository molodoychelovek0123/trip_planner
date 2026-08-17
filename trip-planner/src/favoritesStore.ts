import { create } from 'zustand'
import { useAuthStore } from './store'

export interface FavoritePlace {
  id: string;
  place_id: string; // The google_place_id
  name: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
  photo_reference?: string;
  rating?: number;
  user_ratings_total?: number;
  primary_type?: string;
  recommendedDuration?: number;
}

interface FavoritesState {
  favorites: FavoritePlace[];
  isLoading: boolean;
  error: string | null;
  fetchFavorites: () => Promise<void>;
  addFavorite: (place_id: string) => Promise<void>;
  removeFavorite: (place_id: string) => Promise<void>; // Can take place_id (local db id) or google_place_id
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  isLoading: false,
  error: null,

  fetchFavorites: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/favorites`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch favorites');
      const data = await res.json();
      set({ favorites: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  addFavorite: async (place_id: string) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/favorites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ place_id })
      });
      if (!res.ok) throw new Error('Failed to add favorite');
      
      await get().fetchFavorites();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  removeFavorite: async (place_id: string) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    const previousFavorites = get().favorites;
    set({ favorites: previousFavorites.filter(f => f.place_id !== place_id && f.id !== place_id) });

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/favorites/${place_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        set({ favorites: previousFavorites, error: 'Failed to remove favorite' });
      }
    } catch (err: any) {
      set({ favorites: previousFavorites, error: err.message });
    }
  }
}));
