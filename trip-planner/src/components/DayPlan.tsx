import { useState } from 'react';
import { useTripStore, type DayPlanPlace, type RouteAlternative } from '../store';
import { Car, Footprints, Bus, Clock, Plus, Trash2, GripVertical } from 'lucide-react';
import { SmartSuggestions } from './SmartSuggestions';
import { InlineSearch } from './InlineSearch';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// --- Sortable Item Component ---
function SortablePlaceItem({
  place,
  index,
  activeDayId,
  currentMinutes,
  minutesToTime,
  removeFromDayPlan,
  updatePlaceDuration,
  updateTravelSegment,
  calculateTravelTime,
  calculatingId
}: {
  place: DayPlanPlace;
  index: number;
  activeDayId: string;
  currentMinutes: number;
  minutesToTime: (m: number) => string;
  removeFromDayPlan: (dayId: string, uniqueId: string) => void;
  updatePlaceDuration: (dayId: string, uniqueId: string, duration: number) => void;
  updateTravelSegment: (dayId: string, uniqueId: string, segment: any) => void;
  calculateTravelTime: (index: number, mode: 'DRIVING' | 'WALKING' | 'TRANSIT') => void;
  calculatingId: string | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: place.uniqueId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const arrivalTime = minutesToTime(currentMinutes);
  const departureMinutes = currentMinutes + place.userDuration;
  const departureTime = minutesToTime(departureMinutes);

  const getVehicleIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'SUBWAY':
      case 'METRO_RAIL':
        return <span className="mr-0.5">🚇</span>;
      case 'TRAM':
        return <span className="mr-0.5">🚋</span>;
      case 'TROLLEYBUS':
        return <span className="mr-0.5">🚎</span>;
      case 'BUS':
      case 'INTERCITY_BUS':
        return <span className="mr-0.5">🚌</span>;
      case 'COMMUTER_TRAIN':
      case 'HEAVY_RAIL':
      case 'HIGH_SPEED_TRAIN':
      case 'RAIL':
        return <span className="mr-0.5">🚆</span>;
      case 'FERRY':
        return <span className="mr-0.5">⛴️</span>;
      case 'CABLE_CAR':
      case 'GONDOLA':
        return <span className="mr-0.5">🚠</span>;
      case 'FUNICULAR':
        return <span className="mr-0.5">🚞</span>;
      case 'MONORAIL':
        return <span className="mr-0.5">🚝</span>;
      default:
        return <span className="mr-0.5">🚌</span>; // fallback
    }
  };

  const renderAlternativeBadge = (alt: RouteAlternative, isSelected: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      className={`flex items-center text-xs px-2 py-1 rounded-md border transition-colors ${
        isSelected ? 'bg-blue-50 border-blue-300 shadow-sm' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
      }`}
    >
      <span className={`font-medium mr-2 ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>{alt.durationMinutes} min</span>
      {alt.transitBadges && alt.transitBadges.length > 0 ? (
        <div className="flex items-center gap-1">
          {alt.transitBadges.map((badge, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-1.5 py-0.5 rounded font-bold whitespace-nowrap"
              style={{ backgroundColor: badge.color, color: badge.textColor, fontSize: '0.65rem' }}
            >
              {getVehicleIcon(badge.vehicleType)}
              {badge.shortName}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-gray-500 max-w-[100px] truncate">{alt.summary}</span>
      )}
    </button>
  );

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {index > 0 && (
        <div className="flex items-center justify-center my-2 relative">
          <div className="absolute left-1/2 -ml-px w-0.5 h-full bg-gray-200" aria-hidden="true"></div>
          <div className="relative z-10 bg-white p-2 border rounded-xl text-sm flex flex-col items-center gap-2 shadow-sm min-w-[200px]">
            {place.travelFromPrevious ? (
              <div className="flex flex-col w-full">
                <div className="flex items-center justify-between px-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 font-semibold">
                      {place.travelFromPrevious.durationMinutes} min
                    </span>
                    <div className="flex gap-1 text-gray-400">
                       {place.travelFromPrevious.mode === 'DRIVING' && <Car className="w-4 h-4 text-blue-500" />}
                       {place.travelFromPrevious.mode === 'WALKING' && <Footprints className="w-4 h-4 text-green-500" />}
                       {place.travelFromPrevious.mode === 'TRANSIT' && <Bus className="w-4 h-4 text-orange-500" />}
                    </div>
                  </div>
                  <button
                    className="text-xs text-blue-500 hover:text-blue-700 underline"
                    onClick={() => updateTravelSegment(activeDayId, place.uniqueId, undefined)}
                  >
                    Change mode
                  </button>
                </div>

                {place.travelFromPrevious.routeAlternatives && place.travelFromPrevious.routeAlternatives.length > 1 && (
                  <div className="flex flex-wrap gap-1 mt-1 justify-center bg-gray-50 p-1 rounded-lg">
                    {place.travelFromPrevious.routeAlternatives.map((alt, idx) =>
                      renderAlternativeBadge(
                        alt,
                        (place.travelFromPrevious!.selectedRouteIndex || 0) === idx,
                        () => {
                          updateTravelSegment(activeDayId, place.uniqueId, {
                            ...place.travelFromPrevious,
                            durationMinutes: alt.durationMinutes,
                            selectedRouteIndex: idx,
                            polyline: alt.encodedPolyline,
                          });
                        }
                      )
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                 <span className="text-gray-500 text-xs mr-2">Calculate path:</span>
                 <button onClick={() => calculateTravelTime(index, 'DRIVING')} className="p-1 hover:bg-gray-100 rounded text-blue-600" disabled={calculatingId === place.uniqueId}>
                   <Car className="w-4 h-4" />
                 </button>
                 <button onClick={() => calculateTravelTime(index, 'WALKING')} className="p-1 hover:bg-gray-100 rounded text-green-600" disabled={calculatingId === place.uniqueId}>
                   <Footprints className="w-4 h-4" />
                 </button>
                 <button onClick={() => calculateTravelTime(index, 'TRANSIT')} className="p-1 hover:bg-gray-100 rounded text-orange-600" disabled={calculatingId === place.uniqueId}>
                   <Bus className="w-4 h-4" />
                 </button>
                 {calculatingId === place.uniqueId && <span className="text-xs text-gray-400 animate-pulse">...</span>}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow relative group flex flex-col">
        <div className="flex">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab hover:text-gray-800 text-gray-400 mr-2 mt-1 flex items-start"
          >
            <GripVertical className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between">
              <div>
                <div className="font-semibold text-lg text-gray-800">{place.name}</div>
                <div className="text-sm text-gray-500 font-mono mt-1">
                  {arrivalTime} - {departureTime}
                </div>
              </div>
              <button
                onClick={() => removeFromDayPlan(activeDayId, place.uniqueId)}
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
                value={place.userDuration}
                onChange={(e) => updatePlaceDuration(activeDayId, place.uniqueId, Number(e.target.value) || 0)}
                className="w-16 text-sm border rounded px-1 py-0.5"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main DayPlan Component ---
export function DayPlan() {
  const { days, activeDayId, setActiveDay, addDay, removeDay, setDayStartTime, updatePlaceDuration, removeFromDayPlan, updateTravelSegment, reorderDayPlan } = useTripStore();
  const [calculatingId, setCalculatingId] = useState<string | null>(null);

  const activeDay = days.find(d => d.id === activeDayId) || days[0];
  const dayPlan = activeDay.plan;
  const dayStartTime = activeDay.startTime;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Start dragging after moving 5px
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      const manualTime = window.prompt(`Enter estimated travel time in minutes (${mode}):`, "15");
      if (manualTime && !isNaN(Number(manualTime))) {
        updateTravelSegment(activeDay.id, dayPlan[index].uniqueId, {
          mode,
          durationMinutes: Number(manualTime)
        });
      }
      return;
    }

    const origin = dayPlan[index - 1];
    const destination = dayPlan[index];

    setCalculatingId(destination.uniqueId);

    try {
      // Use the new Google Routes API (REST via fetch)
      // https://developers.google.com/maps/documentation/routes/compute_route_directions
      const routingModeMap: Record<string, string> = {
        'DRIVING': 'DRIVE',
        'WALKING': 'WALK',
        'TRANSIT': 'TRANSIT',
      };

      const requestBody: any = {
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: routingModeMap[mode],
        computeAlternativeRoutes: true,
      };

      if (routingModeMap[mode] === 'DRIVE') {
         requestBody.routingPreference = 'TRAFFIC_UNAWARE';
      }

      const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description,routes.legs.steps.transitDetails.transitLine.name,routes.legs.steps.transitDetails.transitLine.shortName,routes.legs.steps.transitDetails.transitLine.color,routes.legs.steps.transitDetails.transitLine.textColor,routes.legs.steps.transitDetails.transitLine.vehicle.type'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Routes API Error: ${response.status}`);
      }

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const routeAlternatives = data.routes.map((route: any, index: number) => {
          const durationSeconds = parseInt(route.duration.replace('s', ''), 10);

          let summary = route.description || `Option ${index + 1}`;
          let transitBadges: any[] = [];

          // If transit, build badges from transit details
          if (routingModeMap[mode] === 'TRANSIT' && route.legs) {
             route.legs.forEach((leg: any) => {
               if (leg.steps) {
                 leg.steps.forEach((step: any) => {
                   if (step.transitDetails && step.transitDetails.transitLine) {
                     const line = step.transitDetails.transitLine;
                     transitBadges.push({
                        vehicleType: line.vehicle?.type || 'BUS',
                        shortName: line.shortName || line.name || '',
                        color: line.color || '#3B82F6', // Default blue
                        textColor: line.textColor || '#FFFFFF', // Default white
                     });
                   }
                 });
               }
             });
             if (transitBadges.length > 0) {
               summary = transitBadges.map(b => b.shortName).join(' → ');
             }
          }

          return {
            durationMinutes: Math.ceil(durationSeconds / 60),
            summary: summary,
            encodedPolyline: route.polyline?.encodedPolyline || '',
            transitBadges: transitBadges.length > 0 ? transitBadges : undefined
          };
        });

        // Use the first alternative as default
        const bestRoute = routeAlternatives[0];

        updateTravelSegment(activeDay.id, destination.uniqueId, {
          mode,
          durationMinutes: bestRoute.durationMinutes,
          routeAlternatives: routeAlternatives,
          selectedRouteIndex: 0,
          polyline: bestRoute.encodedPolyline,
        });
      } else {
        throw new Error("No route found");
      }
    } catch (error) {
      console.error("Directions request failed", error);
      const manualTime = window.prompt(`API failed. Enter estimated travel time in minutes:`, "15");
      if (manualTime && !isNaN(Number(manualTime))) {
         updateTravelSegment(activeDay.id, destination.uniqueId, {
          mode,
          durationMinutes: Number(manualTime)
        });
      }
    } finally {
      setCalculatingId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = dayPlan.findIndex((item) => item.uniqueId === active.id);
      const newIndex = dayPlan.findIndex((item) => item.uniqueId === over.id);

      let newPlan = arrayMove(dayPlan, oldIndex, newIndex);

      // Invalidate travel segments around the moved item to force recalculation
      newPlan = newPlan.map((item, idx) => {
        // If it's the first item, it doesn't need travel from previous
        if (idx === 0) return { ...item, travelFromPrevious: undefined };
        // If its index changed, or the item before it changed, invalidate travel segment
        if (item.uniqueId === active.id || item.uniqueId === over.id || idx === newIndex + 1 || idx === oldIndex) {
            return { ...item, travelFromPrevious: undefined };
        }
        return item;
      });

      reorderDayPlan(activeDay.id, newPlan);
    }
  };

  let currentMinutes = timeToMinutes(dayStartTime);

  return (
    <div className="flex flex-col">
      {/* Day Selector */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
        {days.map((day, idx) => (
          <button
            key={day.id}
            onClick={() => setActiveDay(day.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeDay.id === day.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Day {idx + 1}
          </button>
        ))}
        <button
          onClick={addDay}
          className="p-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          title="Add new day"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
           <h2 className="text-lg font-bold text-gray-800">Plan</h2>
           {days.length > 1 && (
             <button onClick={() => removeDay(activeDay.id)} className="text-red-400 hover:text-red-600 p-1" title="Delete current day">
               <Trash2 className="w-4 h-4" />
             </button>
           )}
        </div>
        <div className="flex items-center space-x-2 bg-gray-100 px-3 py-1.5 rounded">
          <Clock className="w-4 h-4 text-gray-600" />
          <input
            type="time"
            value={dayStartTime}
            onChange={(e) => setDayStartTime(activeDay.id, e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-800 p-0"
          />
        </div>
      </div>

      {dayPlan.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
          <p>No places added yet.</p>
          <p className="text-sm mt-1">Search for a place below to start planning.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={dayPlan.map(p => p.uniqueId)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {dayPlan.map((place, index) => {
                // Calculate time for this specific render pass
                if (index > 0) {
                   currentMinutes += place.travelFromPrevious?.durationMinutes || 0;
                }

                const arrivalMinutes = currentMinutes;
                const departureMinutes = currentMinutes + place.userDuration;

                currentMinutes = departureMinutes;

                return (
                  <SortablePlaceItem
                    key={place.uniqueId}
                    place={place}
                    index={index}
                    activeDayId={activeDay.id}
                    currentMinutes={arrivalMinutes}
                    minutesToTime={minutesToTime}
                    removeFromDayPlan={removeFromDayPlan}
                    updatePlaceDuration={updatePlaceDuration}
                    updateTravelSegment={updateTravelSegment}
                    calculateTravelTime={calculateTravelTime}
                    calculatingId={calculatingId}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <InlineSearch />
      <SmartSuggestions />
    </div>
  );
}
