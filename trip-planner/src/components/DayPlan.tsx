import React, { useState } from 'react';
import { useTripStore } from '../store';
import { Car, Footprints, Bus, Clock } from 'lucide-react';
import { SmartSuggestions } from './SmartSuggestions';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export function DayPlan() {
  const { dayPlan, dayStartTime, setDayStartTime, updatePlaceDuration, removeFromDayPlan, updateTravelSegment } = useTripStore();
  const [calculatingId, setCalculatingId] = useState<string | null>(null);

  // Helper to parse HH:MM to minutes from midnight
  const timeToMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Helper to format minutes from midnight to HH:MM
  const minutesToTime = (minutes: number) => {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const calculateTravelTime = async (index: number, mode: 'DRIVING' | 'WALKING' | 'TRANSIT') => {
    if (!GOOGLE_MAPS_API_KEY || !(window as any).google) {
      // Fallback if no API key or not loaded: manual prompt
      const manualTime = window.prompt(`Enter estimated travel time in minutes (${mode}):`, "15");
      if (manualTime && !isNaN(Number(manualTime))) {
        updateTravelSegment(dayPlan[index].id, {
          mode,
          durationMinutes: Number(manualTime)
        });
      }
      return;
    }

    const origin = dayPlan[index - 1];
    const destination = dayPlan[index];

    setCalculatingId(destination.id);

    try {
      const directionsService = new (window as any).google.maps.DirectionsService();

      const response = await directionsService.route({
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: (window as any).google.maps.TravelMode[mode],
      });

      if (response.routes[0]?.legs[0]?.duration?.value) {
        // duration is in seconds
        const durationMinutes = Math.ceil(response.routes[0].legs[0].duration.value / 60);
        updateTravelSegment(destination.id, {
          mode,
          durationMinutes
        });
      }
    } catch (error) {
      console.error("Directions request failed", error);
      // Fallback
      const manualTime = window.prompt(`API failed. Enter estimated travel time in minutes:`, "15");
      if (manualTime && !isNaN(Number(manualTime))) {
         updateTravelSegment(destination.id, {
          mode,
          durationMinutes: Number(manualTime)
        });
      }
    } finally {
      setCalculatingId(null);
    }
  };

  let currentMinutes = timeToMinutes(dayStartTime);

  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-800 hidden">Day Plan</h2>
        <div className="flex items-center space-x-2 bg-gray-100 px-3 py-1.5 rounded ml-auto">
          <Clock className="w-4 h-4 text-gray-600" />
          <input
            type="time"
            value={dayStartTime}
            onChange={(e) => setDayStartTime(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-800 p-0"
          />
        </div>
      </div>

      {dayPlan.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
          <p>No places added yet.</p>
          <p className="text-sm mt-1">Add a place from your Triplist to start planning.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dayPlan.map((place, index) => {
            // Update time tracking
            if (index > 0) {
               currentMinutes += place.travelFromPrevious?.durationMinutes || 0;
            }

            const arrivalTime = minutesToTime(currentMinutes);
            const departureMinutes = currentMinutes + place.defaultDuration;
            const departureTime = minutesToTime(departureMinutes);

            // Advance clock for the next place
            currentMinutes = departureMinutes;

            return (
              <React.Fragment key={place.id}>
                {index > 0 && (
                  <div className="flex items-center justify-center my-2 relative">
                    <div className="absolute left-1/2 -ml-px w-0.5 h-full bg-gray-200" aria-hidden="true"></div>
                    <div className="relative z-10 bg-white px-4 py-2 border rounded-full text-sm flex items-center gap-3 shadow-sm">
                      {place.travelFromPrevious ? (
                        <>
                          <span className="text-gray-600 font-medium">
                            {place.travelFromPrevious.durationMinutes} min
                          </span>
                          <div className="flex gap-1 text-gray-400">
                             {place.travelFromPrevious.mode === 'DRIVING' && <Car className="w-4 h-4 text-blue-500" />}
                             {place.travelFromPrevious.mode === 'WALKING' && <Footprints className="w-4 h-4 text-green-500" />}
                             {place.travelFromPrevious.mode === 'TRANSIT' && <Bus className="w-4 h-4 text-orange-500" />}
                          </div>
                          <button
                            className="text-xs text-gray-400 hover:text-gray-600 underline ml-2"
                            onClick={() => updateTravelSegment(place.id, undefined)}
                          >
                            Recalculate
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                           <span className="text-gray-500 text-xs mr-2">Calculate path:</span>
                           <button onClick={() => calculateTravelTime(index, 'DRIVING')} className="p-1 hover:bg-gray-100 rounded text-blue-600" disabled={calculatingId === place.id}>
                             <Car className="w-4 h-4" />
                           </button>
                           <button onClick={() => calculateTravelTime(index, 'WALKING')} className="p-1 hover:bg-gray-100 rounded text-green-600" disabled={calculatingId === place.id}>
                             <Footprints className="w-4 h-4" />
                           </button>
                           <button onClick={() => calculateTravelTime(index, 'TRANSIT')} className="p-1 hover:bg-gray-100 rounded text-orange-600" disabled={calculatingId === place.id}>
                             <Bus className="w-4 h-4" />
                           </button>
                           {calculatingId === place.id && <span className="text-xs text-gray-400 animate-pulse">...</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow relative group">
                  <div className="flex justify-between">
                    <div>
                      <div className="font-semibold text-lg text-gray-800">{place.name}</div>
                      <div className="text-sm text-gray-500 font-mono mt-1">
                        {arrivalTime} - {departureTime}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromDayPlan(place.id)}
                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-xs text-gray-500">Duration (min):</label>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={place.defaultDuration}
                      onChange={(e) => updatePlaceDuration(place.id, Number(e.target.value) || 0)}
                      className="w-16 text-sm border rounded px-1 py-0.5"
                    />
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      <SmartSuggestions />
    </div>
  );
}
