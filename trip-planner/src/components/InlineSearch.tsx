import { useState, useRef, useEffect } from 'react';
import { useTripStore } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { MapPin, Search } from 'lucide-react';
import { useDebounce } from '../utils/useDebounce';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export function InlineSearch() {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const { addToDayPlan, addToTriplist, activeDayId } = useTripStore();
  const debouncedQuery = useDebounce(inputValue, 300);

  useEffect(() => {
    if (!isOpen) return;

    if (!debouncedQuery) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      // 1. Search local triplist first
      const { triplist } = useTripStore.getState();
      const queryLower = debouncedQuery.toLowerCase();
      const localMatches = triplist.filter(p => p.name.toLowerCase().includes(queryLower));

      const formattedLocal = localMatches.map(p => ({
         isLocal: true,
         placeId: p.id,
         description: p.name,
         place: p // store full object
      }));

      let apiSuggestions: any[] = [];

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
              apiSuggestions = (data.suggestions || []).map((s: any) => ({
                 isLocal: false,
                 placeId: s.placePrediction.placeId,
                 description: s.placePrediction.text.text
              }));
          }
        } catch (err) {
          console.error("Failed to fetch API suggestions", err);
        }
      }

      // Merge and deduplicate by placeId
      const combined = [...formattedLocal, ...apiSuggestions];
      const unique = combined.filter((v, i, a) => a.findIndex(t => t.placeId === v.placeId) === i);
      setSuggestions(unique);
    };

    fetchSuggestions();
  }, [debouncedQuery, isOpen]);

  const handlePlaceSelection = async (suggestion: any) => {
    if (!activeDayId) return;

    if (suggestion.isLocal && suggestion.place) {
        addToDayPlan(activeDayId, suggestion.place);
        setInputValue('');
        setSuggestions([]);
        setIsOpen(false);
        return;
    }

    // Fetch place details using Places API New (Place Details) REST endpoint
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/places/${suggestion.placeId}`);

      if (!response.ok) throw new Error("Place Details API failed");

      const data = await response.json();

      if (data && data.location) {
        const newPlace = {
          id: data.id || uuidv4(),
          name: data.displayName?.text || suggestion.description,
          lat: data.location.latitude,
          lng: data.location.longitude,
          recommendedDuration: data.recommendedDuration || 30,
          city: data.city
        };

        addToTriplist(newPlace);
        addToDayPlan(activeDayId, newPlace);

        setInputValue('');
        setSuggestions([]);
        setIsOpen(false);
      }
    } catch (err) {
       console.error("Failed to fetch place details", err);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full mt-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center font-medium"
      >
        <Search className="w-4 h-4 mr-2" />
        Add place to this day
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 border rounded-lg bg-gray-50 shadow-inner relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MapPin className="h-4 w-4 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search for a place on Google Maps..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm"
          autoFocus
        />
      </div>

      {suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-[calc(100%-2rem)] bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.placeId}
              onClick={() => handlePlaceSelection(suggestion)}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex items-center gap-2"
            >
              {suggestion.isLocal && <span className="text-blue-500 font-bold text-xs">SAVED</span>}
              {suggestion.description}
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => {
          setIsOpen(false);
          setInputValue('');
          setSuggestions([]);
        }}
        className="mt-2 text-sm text-gray-500 hover:text-gray-700 w-full text-center"
      >
        Cancel
      </button>
    </div>
  );
}
