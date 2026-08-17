import React, { useEffect, useState, useMemo } from 'react'
import { useFavoritesStore } from '../favoritesStore'
import { PlaceCard } from './PlaceCard'
import { FavoritesSearch } from './FavoritesSearch'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const FavoritesPage: React.FC = () => {
  const {favorites, isLoading, fetchFavorites, error} = useFavoritesStore();
  const [activeCity, setActiveCity] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    favorites.forEach(f => {
      if (f.city) cities.add(f.city);
    });
    return Array.from(cities).sort();
  }, [favorites]);

  const filteredFavorites = useMemo(() => {
    if (activeCity === 'all') return favorites;
    return favorites.filter(f => f.city === activeCity);
  }, [favorites, activeCity]);

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700"/>
          </button>
          <h1 className="text-3xl font-bold text-[#0F294D]">Saved Places</h1>
        </div>

        {/* Search Bar */}
        <FavoritesSearch/>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-2 mb-8 overflow-x-auto">
          <div className="flex space-x-2 min-w-max">
            <button
              onClick={() => setActiveCity('all')}
              className={`px-6 py-2 rounded-md font-medium text-sm transition-colors ${
                activeCity === 'all'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              All cities
            </button>

            {uniqueCities.map(city => (
              <React.Fragment key={city}>
                <div className="w-px bg-gray-200 my-2 mx-2"></div>
                <button
                  onClick={() => setActiveCity(city)}
                  className={`px-6 py-2 rounded-md font-medium text-sm transition-colors ${
                    activeCity === city
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {city}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Filters bar (Mock for now to match screenshot) */}
        <div className="mb-6 flex justify-between items-center">
          <div className="relative">
            <select
              className="appearance-none bg-white border border-gray-300 text-gray-700 py-2 pl-4 pr-10 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option>All</option>
              <option>Sights</option>
              <option>Restaurants</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">
            {error}
          </div>
        ) : filteredFavorites.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-xl font-medium text-gray-900 mb-2">You don't have any saved places yet</h3>
            <p className="text-gray-500">Add interesting places to plan your next trip.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredFavorites.map(place => (
              <PlaceCard key={place.id} place={place}/>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
