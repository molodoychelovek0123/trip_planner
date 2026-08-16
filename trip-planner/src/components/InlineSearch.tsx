import { useState, useRef, useEffect } from 'react';
import { useTripStore } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { MapPin, Search } from 'lucide-react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export function InlineSearch() {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  const { addToDayPlan, addToTriplist, activeDayId } = useTripStore();

  useEffect(() => {
    if (!isOpen) return;

    if (!GOOGLE_MAPS_API_KEY) {
      console.warn("Google Maps API Key is missing. Search won't work correctly.");
      return;
    }

    setOptions({
      key: GOOGLE_MAPS_API_KEY,
      v: "weekly"
    });

    let isMounted = true;

    importLibrary('places').then((placesLibrary) => {
      if (!isMounted) return;
      if (inputRef.current) {
        autocompleteRef.current = new placesLibrary.Autocomplete(inputRef.current, {
          fields: ['place_id', 'geometry', 'name']
        });

        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace();
          if (place && place.geometry && place.geometry.location) {
            handlePlaceSelection(place);
            setInputValue('');
            setIsOpen(false);
          }
        });
      }
    }).catch((err: any) => {
      console.error("Failed to load Google Maps Places API", err);
    });

    return () => {
      isMounted = false;
      if (autocompleteRef.current && (window as any).google) {
         (window as any).google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    }
  }, [isOpen]);

  const handlePlaceSelection = (place: any) => {
    if (!place.geometry?.location || !place.name || !activeDayId) return;

    const newPlace = {
      id: place.place_id || uuidv4(),
      name: place.name,
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
      recommendedDuration: 30
    };

    addToTriplist(newPlace);
    addToDayPlan(activeDayId, newPlace);
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
    <div className="mt-4 p-4 border rounded-lg bg-gray-50 shadow-inner">
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
      <button
        onClick={() => setIsOpen(false)}
        className="mt-2 text-sm text-gray-500 hover:text-gray-700 w-full text-center"
      >
        Cancel
      </button>
    </div>
  );
}
