import { useState } from 'react';
import { useTripStore, type DayPlanPlace, type RouteAlternative } from '../store';
import { Car, Footprints, Bus, Clock, Plus, Trash2, GripVertical, Hotel, AlertCircle, LockOpen, Lock } from 'lucide-react';
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

/**
 * Renders an individual, draggable location card within a day's itinerary.
 * Handles the display of locked times, free time warnings, and travel segment UI.
 */
function SortablePlaceItem({
  place,
  index,
  activeDayId,
  startHotelId,
  currentMinutes,
  projectedArrivalMinutes,
  updateLockedArrivalTime,
  minutesToTime,
  removeFromDayPlan,
  updatePlaceDuration,
  updateTravelSegment,
  calculateTravelTime,
  calculatingId,
  readOnly
}: {
  place: DayPlanPlace;
  index: number;
  activeDayId: string;
  startHotelId?: string;
  currentMinutes: number;
  projectedArrivalMinutes: number;
  updateLockedArrivalTime: (dayId: string, uniqueId: string, time: string | undefined) => void;
  minutesToTime: (m: number) => string;
  removeFromDayPlan: (dayId: string, uniqueId: string) => void;
  updatePlaceDuration: (dayId: string, uniqueId: string, duration: number) => void;
  updateTravelSegment: (dayId: string, uniqueId: string, segment: any) => void;
  calculateTravelTime: (index: number, mode: 'DRIVING' | 'WALKING' | 'TRANSIT') => void;
  calculatingId: string | null;
  readOnly?: boolean;
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

  const freeTimeMinutes = currentMinutes - projectedArrivalMinutes;
  const isLate = projectedArrivalMinutes > currentMinutes && place.lockedArrivalTime;

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
      {/* Travel Block */}
      {(index > 0 || (index === 0 && startHotelId)) && (
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

      {freeTimeMinutes > 0 && (
        <div className="flex items-center justify-center my-1 relative">
          <div className="absolute left-1/2 -ml-px w-0.5 h-full bg-gray-200" aria-hidden="true"></div>
          <div className="relative z-10 bg-green-50 px-3 py-1 border border-green-200 rounded-full text-xs text-green-700 shadow-sm">
            Free time: {freeTimeMinutes} min
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
                <div className="flex items-center gap-2 mt-1">
                  {place.lockedArrivalTime ? (
                    <div className="flex items-center text-sm font-mono border border-blue-500 bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
                      <input
                        type="time"
                        value={place.lockedArrivalTime}
                        onChange={(e) => updateLockedArrivalTime(activeDayId, place.uniqueId, e.target.value || undefined)}
                        className="bg-transparent border-none focus:ring-0 p-0 text-sm w-12"
                        disabled={readOnly}
                      />
                      <button
                        onClick={() => updateLockedArrivalTime(activeDayId, place.uniqueId, undefined)}
                        className="ml-1 text-blue-400 hover:text-blue-600 focus:outline-none"
                        title="Unlock auto-calculation"
                        disabled={readOnly}
                      >
                        <Lock className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="flex items-center text-sm font-mono text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded px-1.5 py-0.5 transition-colors group"
                      onClick={() => updateLockedArrivalTime(activeDayId, place.uniqueId, arrivalTime)}
                      title="Click to lock this arrival time"
                      disabled={readOnly}
                    >
                      {arrivalTime}
                      {!readOnly && <LockOpen className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </button>
                  )}

                  <span className="text-gray-500 font-mono">— {departureTime}</span>
                  {isLate && (
                    <div className="flex items-center text-red-500 text-xs font-medium ml-2 bg-red-50 px-1.5 py-0.5 rounded border border-red-200" title={`Projected arrival: ${minutesToTime(projectedArrivalMinutes)}`}>
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Late
                    </div>
                  )}
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
                disabled={readOnly}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main component for assembling and managing the itinerary of a specific day.
 * Includes drag-and-drop, hotel selection, and cascading time calculations.
 */
export function DayPlan({ readOnly = false }: { readOnly?: boolean }) {
  const { triplist, days, activeDayId, setActiveDay, addDay, removeDay, setDayStartTime, updatePlaceDuration, removeFromDayPlan, updateTravelSegment, reorderDayPlan, setStartHotel, setEndHotel, updateEndHotelTravel, updateLockedArrivalTime } = useTripStore();
  const [calculatingId, setCalculatingId] = useState<string | null>(null);

  const activeDay = days.find(d => d.id === activeDayId) || days[0];
  const dayPlan = activeDay?.plan || [];
  const dayStartTime = activeDay?.startTime || '09:00';

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

  if (!activeDay) return null;

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

    let origin, destination, isEndHotel = false;

    if (index === -1) {
       // End hotel calculation
       origin = dayPlan[dayPlan.length - 1];
       const hotel = triplist.find(p => p.id === activeDay.endHotelId);
       if (!hotel) return;
       destination = hotel;
       isEndHotel = true;
       setCalculatingId('end-hotel');
    } else {
       // Normal segment
       origin = index === 0 ? triplist.find(p => p.id === activeDay.startHotelId) : dayPlan[index - 1];
       destination = dayPlan[index];
       if (!origin || !destination) return;
       setCalculatingId(destination.uniqueId);
    }

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
        "X-Goog-FieldMask": 'routes.duration,routes.distanceMeters,routes.description,routes.legs.steps.travelMode,routes.legs.steps.polyline.encodedPolyline,routes.legs.steps.transitDetails.transitLine.name,routes.legs.steps.transitDetails.transitLine.color,routes.legs.steps.transitDetails.transitLine.textColor,routes.legs.steps.transitDetails.transitLine.vehicle.type'
      };

      if (routingModeMap[mode] === 'DRIVE') {
         requestBody.routingPreference = 'TRAFFIC_UNAWARE';
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/routes/compute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
          let steps: any[] = [];

          if (route.legs) {
            route.legs.forEach((leg: any) => {
              if (leg.steps) {
                leg.steps.forEach((step: any) => {
                  let stepColor = undefined;

                  if (step.travelMode === 'TRANSIT' && step.transitDetails && step.transitDetails.transitLine) {
                     const line = step.transitDetails.transitLine;
                     stepColor = line.color || '#3B82F6';

                     // Build badges only if this is a transit overall request, or we just want badges for any transit leg
                     if (routingModeMap[mode] === 'TRANSIT') {
                       transitBadges.push({
                          vehicleType: line.vehicle?.type || 'BUS',
                          shortName: line.shortName || line.name || '',
                          color: stepColor,
                          textColor: line.textColor || '#FFFFFF',
                       });
                     }
                  }

                  if (step.polyline && step.polyline.encodedPolyline) {
                    steps.push({
                      travelMode: step.travelMode || routingModeMap[mode],
                      encodedPolyline: step.polyline.encodedPolyline,
                      color: stepColor
                    });
                  }
                });
              }
            });
          }

          if (routingModeMap[mode] === 'TRANSIT' && transitBadges.length > 0) {
             summary = transitBadges.map(b => b.shortName).join(' → ');
          }

          return {
            durationMinutes: Math.ceil(durationSeconds / 60),
            summary: summary,
            steps: steps,
            transitBadges: transitBadges.length > 0 ? transitBadges : undefined
          };
        });

        // Use the first alternative as default
        const bestRoute = routeAlternatives[0];

        const segmentData = {
          mode,
          durationMinutes: bestRoute.durationMinutes,
          routeAlternatives: routeAlternatives,
          selectedRouteIndex: 0,
        };

        if (isEndHotel) {
          updateEndHotelTravel(activeDay.id, segmentData);
        } else {
          updateTravelSegment(activeDay.id, (destination as DayPlanPlace).uniqueId, segmentData);
        }
      } else {
        throw new Error("No route found");
      }
    } catch (error) {
      console.error("Directions request failed", error);
      const manualTime = window.prompt(`API failed. Enter estimated travel time in minutes:`, "15");
      if (manualTime && !isNaN(Number(manualTime))) {
        const fallbackData = { mode, durationMinutes: Number(manualTime) };
        if (isEndHotel) {
           updateEndHotelTravel(activeDay.id, fallbackData as any);
        } else {
           updateTravelSegment(activeDay.id, (destination as DayPlanPlace).uniqueId, fallbackData as any);
        }
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
           {!readOnly && days.length > 1 && (
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
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center">
          <Hotel className="w-3 h-3 mr-1" /> Start Hotel
        </label>
        <select
          className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
          value={activeDay.startHotelId || ''}
          onChange={(e) => setStartHotel(activeDay.id, e.target.value || undefined)}
          disabled={readOnly}
        >
          <option value="">(No start hotel selected)</option>
          {triplist.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {dayPlan.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
          <p>No places added yet.</p>
          <p className="text-sm mt-1">Search for a place below to start planning.</p>
        </div>
      ) : readOnly ? (
        <div className="space-y-4">
          {dayPlan.map((place, index) => {
            let currentMinutes = timeToMinutes(dayStartTime);

            // Forward-calculate arrival time
            let arrivalTimeMins = currentMinutes;
            if (index === 0 && place.travelFromPrevious) {
                arrivalTimeMins += place.travelFromPrevious.durationMinutes;
            } else if (index > 0) {
                // Find previous item's departure
                let prevDep = timeToMinutes(dayStartTime);
                for (let i = 0; i < index; i++) {
                   const pItem = dayPlan[i];
                   if (i === 0 && pItem.travelFromPrevious) prevDep += pItem.travelFromPrevious.durationMinutes;

                   if (pItem.lockedArrivalTime) {
                       prevDep = timeToMinutes(pItem.lockedArrivalTime);
                   } else if (i > 0 && pItem.travelFromPrevious) {
                       prevDep += pItem.travelFromPrevious.durationMinutes;
                   }
                   prevDep += pItem.userDuration;
                }
                if (place.travelFromPrevious) {
                    arrivalTimeMins = prevDep + place.travelFromPrevious.durationMinutes;
                } else {
                    arrivalTimeMins = prevDep;
                }
            }

            const projectedArrival = arrivalTimeMins;
            if (place.lockedArrivalTime) {
               const lockedMins = timeToMinutes(place.lockedArrivalTime);
               currentMinutes = lockedMins;
            }

            const actualArrival = currentMinutes;
            const departureMinutes = currentMinutes + place.userDuration;

            currentMinutes = departureMinutes;

            return (
              <SortablePlaceItem
                key={place.uniqueId}
                place={place}
                index={index}
                activeDayId={activeDay.id}
                startHotelId={activeDay.startHotelId}
                currentMinutes={actualArrival}
                projectedArrivalMinutes={projectedArrival}
                minutesToTime={minutesToTime}
                removeFromDayPlan={removeFromDayPlan}
                updatePlaceDuration={updatePlaceDuration}
                updateTravelSegment={updateTravelSegment}
                calculateTravelTime={calculateTravelTime}
                calculatingId={calculatingId}
                updateLockedArrivalTime={updateLockedArrivalTime}
                readOnly={readOnly}
              />
            );
          })}
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
                let travelTime = 0;
                if (index > 0) {
                   travelTime = place.travelFromPrevious?.durationMinutes || 0;
                } else if (index === 0 && activeDay.startHotelId) {
                   travelTime = place.travelFromPrevious?.durationMinutes || 0;
                }

                currentMinutes += travelTime;

                const projectedArrival = currentMinutes;

                if (place.lockedArrivalTime) {
                   const lockedMins = timeToMinutes(place.lockedArrivalTime);
                   currentMinutes = lockedMins; // Unconditionally lock time to prevent cascading shifts
                }

                const actualArrival = currentMinutes;
                const departureMinutes = currentMinutes + place.userDuration;

                currentMinutes = departureMinutes;

                return (
                  <SortablePlaceItem
                    key={place.uniqueId}
                    place={place}
                    index={index}
                    activeDayId={activeDay.id}
                    startHotelId={activeDay.startHotelId}
                    currentMinutes={actualArrival}
                    projectedArrivalMinutes={projectedArrival}
                    minutesToTime={minutesToTime}
                    removeFromDayPlan={removeFromDayPlan}
                    updatePlaceDuration={updatePlaceDuration}
                    updateTravelSegment={updateTravelSegment}
                    calculateTravelTime={calculateTravelTime}
                    calculatingId={calculatingId}
                    updateLockedArrivalTime={updateLockedArrivalTime}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {dayPlan.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center">
            <Hotel className="w-3 h-3 mr-1" /> End Hotel
          </label>
          <div className="flex gap-2">
            <select
              className="flex-1 text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
              value={activeDay.endHotelId || ''}
              onChange={(e) => setEndHotel(activeDay.id, e.target.value || undefined)}
              disabled={readOnly}
            >
              <option value="">(No end hotel selected)</option>
              {triplist.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {activeDay.endHotelId && (
            <div className="mt-3 flex items-center justify-center relative">
              <div className="absolute left-1/2 -ml-px w-0.5 h-full bg-gray-200" aria-hidden="true"></div>
              <div className="relative z-10 bg-white p-2 border rounded-xl text-sm flex flex-col items-center gap-2 shadow-sm min-w-[200px]">
                {activeDay.endHotelTravel ? (
                  <div className="flex flex-col w-full">
                    <div className="flex items-center justify-between px-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-700 font-semibold">
                          {activeDay.endHotelTravel.durationMinutes} min
                        </span>
                        <div className="flex gap-1 text-gray-400">
                           {activeDay.endHotelTravel.mode === 'DRIVING' && <Car className="w-4 h-4 text-blue-500" />}
                           {activeDay.endHotelTravel.mode === 'WALKING' && <Footprints className="w-4 h-4 text-green-500" />}
                           {activeDay.endHotelTravel.mode === 'TRANSIT' && <Bus className="w-4 h-4 text-orange-500" />}
                        </div>
                      </div>
                      <button
                        className="text-xs text-blue-500 hover:text-blue-700 underline"
                        onClick={() => updateEndHotelTravel(activeDay.id, undefined)}
                      >
                        Change mode
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                     <span className="text-gray-500 text-xs mr-2">Go to hotel:</span>
                     <button onClick={() => calculateTravelTime(-1, 'DRIVING')} className="p-1 hover:bg-gray-100 rounded text-blue-600" disabled={calculatingId === 'end-hotel'}>
                       <Car className="w-4 h-4" />
                     </button>
                     <button onClick={() => calculateTravelTime(-1, 'WALKING')} className="p-1 hover:bg-gray-100 rounded text-green-600" disabled={calculatingId === 'end-hotel'}>
                       <Footprints className="w-4 h-4" />
                     </button>
                     <button onClick={() => calculateTravelTime(-1, 'TRANSIT')} className="p-1 hover:bg-gray-100 rounded text-orange-600" disabled={calculatingId === 'end-hotel'}>
                       <Bus className="w-4 h-4" />
                     </button>
                     {calculatingId === 'end-hotel' && <span className="text-xs text-gray-400 animate-pulse">...</span>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <InlineSearch />
      <SmartSuggestions />
    </div>
  );
}
