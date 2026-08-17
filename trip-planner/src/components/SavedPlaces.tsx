import { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { Trash2, MapPin } from 'lucide-react';
import { SavedPlacesMap } from './SavedPlacesMap';
import { useDebounce } from '../utils/useDebounce';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export function SavedPlaces() {
  const { token } = useAuthStore();
  const [places, setPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);

  // Search state
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const debouncedQuery = useDebounce(inputValue, 300);

  const fetchPlaces = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/saved-places`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPlaces(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaces();
  }, [token]);

  // Autocomplete logic
  useEffect(() => {
    if (!debouncedQuery) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        const res = await fetch(`${API_URL}/api/places/autocomplete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: debouncedQuery })
        });
        const data = await res.json();
        if (data.suggestions) {
          setSuggestions(data.suggestions.map((s: any) => ({
             place_id: s.placePrediction.placeId,
             name: s.placePrediction.structuredFormat.mainText.text,
             address: s.placePrediction.structuredFormat.secondaryText?.text
          })));
        }
      } catch (e) {
        console.error("Autocomplete error", e);
      }
    };
    fetchSuggestions();
  }, [debouncedQuery]);

  const handleAddPlace = async (suggestion: any) => {
    if (!token) return;
    try {
      // First get full details
      const detailRes = await fetch(`${API_URL}/api/places/${suggestion.place_id}`);
      const detailData = await detailRes.json();

      const payload = {
         id: detailData.id,
         google_place_id: detailData.id,
         name: detailData.displayName.text,
         lat: detailData.location.latitude,
         lng: detailData.location.longitude,
         city: detailData.addressComponents?.find((c:any) => c.types.includes('locality'))?.longText,
         notes: ''
      };

      const res = await fetch(`${API_URL}/api/saved-places`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setInputValue('');
        setSuggestions([]);
        fetchPlaces();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (placeId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/saved-places/${placeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setPlaces(places.filter(p => p.id !== placeId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateNotes = async (placeId: string, notes: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/saved-places/${placeId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notes })
      });
      if (res.ok) {
         setPlaces(places.map(p => p.id === placeId ? { ...p, notes } : p));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const cities = ['All', ...Array.from(new Set(places.map(p => p.city).filter(Boolean)))];
  const filteredPlaces = selectedCity === 'All' ? places : places.filter(p => p.city === selectedCity);

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-gray-200 shrink-0">
          <h1 className="text-2xl font-bold mb-4">Saved Places</h1>

          {/* Search */}
          <div className="relative mb-4">
             <input
                type="text"
                placeholder="Search and add new place..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
             />
             {suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                  {suggestions.map(s => (
                     <div
                        key={s.place_id}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => handleAddPlace(s)}
                     >
                        <div className="font-medium">{s.name}</div>
                        <div className="text-sm text-gray-500">{s.address}</div>
                     </div>
                  ))}
                </div>
             )}
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={selectedCity}
              onChange={e => setSelectedCity(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
            >
              {cities.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filteredPlaces.length === 0 ? (
            <div className="text-gray-500 text-center py-8">No places found.</div>
          ) : (
            filteredPlaces.map(place => (
              <div
                key={place.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                onMouseEnter={() => setHoveredPlaceId(place.id)}
                onMouseLeave={() => setHoveredPlaceId(null)}
              >
                <div className="flex justify-between items-start mb-2">
                   <div>
                      <h3 className="font-bold text-lg">{place.name}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin size={14} /> {place.city || 'Unknown City'}
                      </p>
                   </div>
                   <button
                     onClick={() => handleDelete(place.id)}
                     className="text-gray-400 hover:text-red-500 transition-colors"
                     title="Delete"
                   >
                     <Trash2 size={18} />
                   </button>
                </div>

                <div className="mt-2">
                   <textarea
                     className="w-full text-sm p-2 border border-gray-200 rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
                     placeholder="Add personal notes..."
                     rows={2}
                     defaultValue={place.notes || ''}
                     onBlur={(e) => handleUpdateNotes(place.id, e.target.value)}
                   />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Map */}
      <div className="w-2/3 h-full">
         <SavedPlacesMap places={filteredPlaces} hoveredPlaceId={hoveredPlaceId} />
      </div>
    </div>
  );
}
