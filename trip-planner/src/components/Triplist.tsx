import React, { useState, useRef, useEffect } from 'react';
import { useTripStore } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { MapPin } from 'lucide-react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export function Triplist() {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { triplist, addToTriplist, removeFromTriplist } = useTripStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn("Google Maps API Key is missing. Using manual entry fallback.");
      return;
    }

    setOptions({
      key: GOOGLE_MAPS_API_KEY,
      v: "weekly"
    });

    importLibrary('places').then((placesLibrary) => {
      if (inputRef.current) {
        autocompleteRef.current = new placesLibrary.Autocomplete(inputRef.current, {
          fields: ['place_id', 'geometry', 'name']
        });

        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace();
          if (place && place.geometry && place.geometry.location) {
            handlePlaceSelection(place);
            setInputValue('');
          }
        });
      }
    }).catch((err: any) => {
      console.error("Failed to load Google Maps API", err);
      setError("Failed to load map services.");
    });
  }, []);

  const handlePlaceSelection = (place: any) => {
    if (!place.geometry?.location || !place.name) return;

    addToTriplist({
      id: place.place_id || uuidv4(),
      name: place.name,
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
      defaultDuration: 60 // BR-1: default duration
    });
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    if (!GOOGLE_MAPS_API_KEY) {
      // Fallback manual add if no API key
      addToTriplist({
        id: uuidv4(),
        name: inputValue.trim(),
        lat: 0,
        lng: 0,
        defaultDuration: 60
      });
      setInputValue('');
    }
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
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search for a place..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          {!GOOGLE_MAPS_API_KEY && (
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Add
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>

      <div className="space-y-3">
        {triplist.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No places added yet. Search for places to add them to your pool.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {triplist.map((place) => (
              <li key={place.id} className="py-3 flex justify-between items-center group">
                <div>
                  <p className="text-sm font-medium text-gray-900">{place.name}</p>
                  <p className="text-xs text-gray-500">{place.defaultDuration} min</p>
                </div>
                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => useTripStore.getState().addToDayPlan(place)}
                    className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                  >
                    Add to Plan
                  </button>
                  <button
                    onClick={() => removeFromTriplist(place.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
