import { useState, useRef, useEffect } from 'react';
import { useTripStore } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { MapPin } from 'lucide-react';
import { useDebounce } from '../utils/useDebounce';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

/**
 * Component for managing the user's pool of saved locations ("Triplist").
 * Integrates with Google Places API (New) via a debounced fetch for autocompletion.
 */
export function Triplist() {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { triplist, addToTriplist, removeFromTriplist, days, addToDayPlan } = useTripStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(inputValue, 300);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn("Google Maps API Key is missing. Search won't work correctly.");
      return;
    }

    if (!debouncedQuery) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          },
          body: JSON.stringify({
            input: debouncedQuery,
          })
        });

        if (!response.ok) throw new Error("Autocomplete API failed");

        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } catch (err) {
        console.error("Failed to fetch suggestions", err);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery]);

  const handlePlaceSelection = async (placeId: string, description: string) => {
    if (!GOOGLE_MAPS_API_KEY) return;

    try {
      const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}?fields=id,displayName,location`, {
        headers: {
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        }
      });

      if (!response.ok) throw new Error("Place Details API failed");

      const data = await response.json();

      if (data && data.location) {
        addToTriplist({
          id: data.id || uuidv4(),
          name: data.displayName?.text || description,
          lat: data.location.latitude,
          lng: data.location.longitude,
          recommendedDuration: 30
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
        <div className="flex gap-2">
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
            />
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
            {suggestions.map((suggestion) => (
              <li
                key={suggestion.placePrediction.placeId}
                onClick={() => handlePlaceSelection(suggestion.placePrediction.placeId, suggestion.placePrediction.text.text)}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 border-b border-gray-100 last:border-b-0"
              >
                {suggestion.placePrediction.text.text}
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="space-y-3">
        {triplist.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No places added yet. Search for places to add them to your pool.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {triplist.map((place) => (
              <li key={place.id} className="py-3 flex flex-col group border-b border-gray-100 last:border-b-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{place.name}</p>
                    <p className="text-xs text-gray-500">{place.recommendedDuration} min</p>
                    {place.description && (
                      <p className="text-xs text-gray-600 mt-1 italic">{place.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeFromTriplist(place.id)}
                    className="text-red-400 hover:text-red-700 text-xs opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-3 relative bg-gray-50 p-2 rounded-md border border-gray-100">
                  <div className="flex flex-col gap-2">
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
