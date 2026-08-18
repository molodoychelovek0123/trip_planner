import { useState, useRef, useEffect } from 'react';
import { useFavoritesStore } from '../favoritesStore';
import { MapPin, Search, Loader2 } from 'lucide-react';
import { useDebounce } from '../utils/useDebounce';
import type { PlacePredictionWrapper } from '../types/googlePlaces';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface Suggestion {
  placeId: string;
  description: string;
}

export function FavoritesSearch() {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { addFavorite } = useFavoritesStore();
  const debouncedQuery = useDebounce(inputValue, 300);

  useEffect(() => {
    if (!debouncedQuery) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setIsSearching(true);
      if (GOOGLE_MAPS_API_KEY) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/places/autocomplete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: debouncedQuery
            })
          });

          if (response.ok) {
              const data = await response.json();
              const apiSuggestions = (data?.suggestions || []).map((s: PlacePredictionWrapper) => ({
                 placeId: s.placePrediction.placeId,
                 description: s.placePrediction.text.text
              }));
              setSuggestions(apiSuggestions);
          }
        } catch (err) {
          console.error("Failed to fetch API suggestions", err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setIsSearching(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery]);

  const handlePlaceSelection = async (suggestion: Suggestion) => {
    setIsAdding(true);
    try {
      await addFavorite(suggestion.placeId);
      setInputValue('');
      setSuggestions([]);
    } catch (err) {
      console.error("Failed to add favorite", err);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="relative w-full max-w-xl mx-auto mb-8 z-10">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search for a place to add to Saved Places..."
          className="block w-full pl-11 pr-10 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-base shadow-sm transition-all"
        />
        {isSearching && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <ul className="absolute mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-auto divide-y divide-gray-100">
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.placeId}
              onClick={() => !isAdding && handlePlaceSelection(suggestion)}
              className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-gray-700 flex items-start gap-3 transition-colors"
            >
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
              <span className="text-sm">{suggestion.description}</span>
            </li>
          ))}
        </ul>
      )}
      
      {isAdding && (
         <div className="absolute top-14 right-0 bg-blue-600 text-white text-xs px-3 py-1 rounded-full animate-pulse shadow-md">
           Saving...
         </div>
      )}
    </div>
  );
}
