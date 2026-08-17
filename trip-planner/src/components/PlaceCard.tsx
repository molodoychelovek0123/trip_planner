import React from 'react'
import { Heart } from 'lucide-react'
import { type FavoritePlace, useFavoritesStore } from '../favoritesStore'

interface PlaceCardProps {
  place: FavoritePlace;
}

export const PlaceCard: React.FC<PlaceCardProps> = ({ place }) => {
  const { removeFavorite, favorites } = useFavoritesStore();
  const isFavorite = favorites.some(f => f.place_id === place.place_id || f.id === place.place_id);

  const toggleFavorite = () => {
    if (isFavorite) {
      removeFavorite(place.place_id);
    }
    // We only support removing from this view based on requirements.
  };

  const getPhotoUrl = () => {
    if (place.photo_reference) {
      return `https://places.googleapis.com/v1/${place.photo_reference}/media?maxHeightPx=400&maxWidthPx=400&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
    }
    return 'https://images.unsplash.com/photo-1488085061387-422e29b40080?q=80&w=600&auto=format&fit=crop';
  };

  const badgeText = place.primary_type ? place.primary_type.replace(/_/g, ' ') : 'Sights';
  
  // Format rating nicely
  const ratingText = place.rating ? place.rating.toFixed(1) : 'N/A';
  const reviewsText = place.user_ratings_total ? `${place.user_ratings_total} review${place.user_ratings_total !== 1 ? 's' : ''}` : '';

  return (
    <div className="flex flex-col bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300">
      {/* Image Container */}
      <div className="relative h-48 w-full bg-gray-200">
        <img 
          src={getPhotoUrl()} 
          alt={place.name} 
          className="w-full h-full object-cover"
        />
        
        {/* Badge */}
        <div className="absolute top-3 left-3 bg-gray-900/60 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded">
          <span className="capitalize">{badgeText === 'Sights' ? badgeText : (
             badgeText === 'tourist attraction' ? 'Sights' : 
             badgeText === 'restaurant' ? 'Restaurant' : badgeText
          )}</span>
        </div>

        {/* Heart Icon */}
        <button 
          onClick={toggleFavorite}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-black/10 transition-colors"
        >
          <Heart 
            className={`w-6 h-6 ${isFavorite ? 'fill-pink-500 text-pink-500' : 'text-white'}`} 
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <span className="text-sm text-gray-500 mb-1">{place.city || 'Unknown City'}</span>
        <h3 className="font-semibold text-lg text-gray-900 leading-tight mb-3 flex-1">{place.name}</h3>
        
        <div className="flex items-center text-sm">
          <span className="font-bold text-[#0F294D]">{ratingText}/5</span>
          {reviewsText && (
            <span className="text-gray-500 ml-1">· {reviewsText}</span>
          )}
        </div>
      </div>
    </div>
  )
}
