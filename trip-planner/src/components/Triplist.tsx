import { useState, useRef, useEffect } from 'react';
import { useTripStore } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { MapPin, Bookmark } from 'lucide-react';
import { useDebounce } from '../utils/useDebounce';
import type { SuggestionItem } from '../types/suggestions';
import type { PlacePredictionWrapper } from '../types/googlePlaces';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

/**
 * Component for managing the user's pool of saved locations ("Triplist").
 * Integrates with Google Places API (New) via a debounced fetch for autocompletion.
 */
export function Triplist({ readOnly = false }: { readOnly?: boolean }) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { triplist, addToTriplist, removeFromTriplist, days, addToDayPlan, activeDayId } = useTripStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(inputValue, 300);

  // Smart filtering: determine current city from the last active plan item
  let currentCity: string | undefined = undefined;
  let referenceLat: number | undefined = undefined;
  let referenceLng: number | undefined = undefined;

  const activeDay = days.find(d => d.id === activeDayId);
  if (activeDay) {
    if (activeDay.plan.length > 0) {
      const lastItem = activeDay.plan[activeDay.plan.length - 1];
      currentCity = lastItem.city;
      referenceLat = lastItem.lat;
      referenceLng = lastItem.lng;
    } else if (activeDay.startHotelId) {
      const startHotel = triplist.find(p => p.id === activeDay.startHotelId);
      if (startHotel) {
        currentCity = startHotel.city;
        referenceLat = startHotel.lat;
        referenceLng = startHotel.lng;
      }
    }
  }

  // Filter and sort triplist
  let displayTriplist = [...triplist];
  if (currentCity) {
    displayTriplist = displayTriplist.filter(p => !p.city || p.city === currentCity);
    if (referenceLat !== undefined && referenceLng !== undefined) {
      // Calculate distance for sorting
      // We can reuse a simple haversine formula here or just simple distance squared since it's for relative sorting
      const distSq = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        return Math.pow(lat1 - lat2, 2) + Math.pow(lng1 - lng2, 2);
      };
      displayTriplist.sort((a, b) => distSq(referenceLat!, referenceLng!, a.lat, a.lng) - distSq(referenceLat!, referenceLng!, b.lat, b.lng));
    }
  }

  useEffect(() => {
    if (!debouncedQuery) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      // 1. Search local triplist first
      const queryLower = debouncedQuery.toLowerCase();
      const localMatches = triplist.filter(p => p.name.toLowerCase().includes(queryLower));

      const formattedLocal = localMatches.map(p => ({
         isLocal: true,
         placeId: p.id,
         description: p.name,
         place: p // store full object
      }));

      let apiSuggestions: SuggestionItem[] = [];

      if (GOOGLE_MAPS_API_KEY) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/places/autocomplete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: debouncedQuery,
            })
          });

          if (response.ok) {
              const data = await response.json();
              apiSuggestions = (data.suggestions || []).map((s: PlacePredictionWrapper) => ({
                 isLocal: false,
                 placeId: s.placePrediction.placeId,
                 description: s.placePrediction.text.text
              }));
          }
        } catch (err) {
          console.error("Failed to fetch API suggestions", err);
        }
      }

      // Merge and deduplicate by placeId (if the local one has the same Google Place ID, etc.)
      const combined = [...formattedLocal, ...apiSuggestions];
      const unique = combined.filter((v, i, a) => a.findIndex(t => t.placeId === v.placeId) === i);
      setSuggestions(unique);
    };

    fetchSuggestions();
  }, [debouncedQuery, triplist]);

  const handlePlaceSelection = async (suggestion: SuggestionItem) => {
    if (suggestion.isLocal) {
        // It's already in the triplist, maybe we just clear or show a message?
        // Let's just clear the input
        setInputValue('');
        setSuggestions([]);
        return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/places/${suggestion.placeId}`);

      if (!response.ok) throw new Error("Place Details API failed");

      const data = await response.json();

      if (data && data.location) {
        addToTriplist({
          id: data.id || uuidv4(),
          name: data.displayName?.text || suggestion.description,
          lat: data.location.latitude,
          lng: data.location.longitude,
          recommendedDuration: data.recommendedDuration || 30,
          city: data.city
        });

        setInputValue('');
        setSuggestions([]);
      }
    } catch (err) {
       console.error("Failed to fetch place details", err);
       setError("Failed to get place details.");
    }
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setError("Please select a place from the dropdown to ensure accurate routing.");
  };

  return (
    <div className="flex flex-col">
      <h2 className="text-lg font-bold mb-4 text-gray-800 hidden">My Saved Places</h2>

      <form onSubmit={handleManualAdd} className="mb-4 relative">
        {!readOnly && (
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MapPin className="h-5 w-5 text-gray-400" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setError(null);
                }}
                placeholder="Search for a place..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm"
                disabled={readOnly}
              />
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {!readOnly && suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
            {suggestions.map((suggestion) => (
              <li
                key={suggestion.placeId}
                onClick={() => handlePlaceSelection(suggestion)}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 border-b border-gray-100 last:border-b-0 flex items-center gap-2"
              >
                {suggestion.isLocal && <Bookmark className="w-3 h-3 text-blue-500" />}
                {suggestion.description}
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="space-y-3">
        {displayTriplist.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
             {triplist.length === 0
                ? "No places added yet. Search for places to add them to your pool."
                : currentCity
                    ? `Nothing saved in ${currentCity} yet.`
                    : "No places match your criteria."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {displayTriplist.map((place) => (
              <li key={place.id} className="py-3 flex flex-col group border-b border-gray-100 last:border-b-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{place.name}</p>
                    <p className="text-xs text-gray-500">{place.recommendedDuration} min</p>
                    {place.description && (
                      <p className="text-xs text-gray-600 mt-1 italic">{place.description}</p>
                    )}
                  </div>
                  {!readOnly && (
                    <button
                      onClick={() => removeFromTriplist(place.id)}
                      className="text-red-400 hover:text-red-700 text-xs opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="mt-3 relative bg-gray-50 p-2 rounded-md border border-gray-100">
                  {!readOnly && (
                    <div className="flex flex-col gap-2 w-full mt-3 pt-3 border-t border-gray-100">
                       <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Add to Plan:</span>
                       <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                          {days.map((day, idx) => (
                            <button
                              key={day.id}
                              onClick={() => addToDayPlan(day.id, place)}
                              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md shadow-sm border border-blue-200 whitespace-nowrap transition-colors"
                            >
                              + Day {idx + 1}
                            </button>
                          ))}
                       </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
