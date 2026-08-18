import { useState } from 'react';
import { useTripStore, type DayPlanPlace, type RouteAlternative, type TravelSegment, type TransitBadge, type RouteStep } from '../store';
import { Car, Footprints, Bus, Clock, GripVertical, Hotel, AlertCircle, LockOpen, Lock, Plus, Trash2, Pencil } from 'lucide-react';
import { SmartSuggestions } from './SmartSuggestions';
import { InlineSearch } from './InlineSearch';
import { AddFlightModal } from './AddFlightModal';
import { FlightCard } from './FlightCard';
import { getAirportLocation } from '../utils/airports';
import { wgs84ToGcj02, outOfChina } from '../utils/coords';
import type { ComputeRouteRequest, Route, RouteLeg, RouteStepDetail } from '../types/googleRoutes';
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

function MapDeepLinks({ 
  originLat, originLng, originName, 
  destLat, destLng, destName 
}: { 
  originLat?: number, originLng?: number, originName?: string, 
  destLat?: number, destLng?: number, destName?: string 
}) {
  if (!originLat || !originLng || !destLat || !destLng) return null;

  // Check if coordinates are in China (if either origin or dest is in China, we can show AMap)
  const isChina = !outOfChina(originLng, originLat) || !outOfChina(destLng, destLat);

  const googleMapsUri = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=transit`;

  if (!isChina) {
    return (
      <div className="inline-block ml-auto mt-2 w-full text-right">
        <a href={googleMapsUri} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded inline-flex items-center gap-1 transition-colors shadow-sm">
          Открыть в Google Maps
        </a>
      </div>
    );
  }

  // GCJ02 for AMap/Baidu
  const [gcjSlng, gcjSlat] = wgs84ToGcj02(originLng, originLat);
  const [gcjDlng, gcjDlat] = wgs84ToGcj02(destLng, destLat);

  const aMapUri = `https://uri.amap.com/navigation?from=${gcjSlng},${gcjSlat},${encodeURIComponent(originName || '')}&to=${gcjDlng},${gcjDlat},${encodeURIComponent(destName || '')}&mode=bus&callnative=1`;

  return (
    <div className="relative group inline-block ml-auto mt-2 w-full text-right">
      <button className="text-[11px] font-medium text-slate-500 hover:text-slate-800 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded inline-flex items-center gap-1 transition-colors shadow-sm">
        Открыть в
        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      <div className="absolute right-0 bottom-full mb-1 hidden group-hover:flex flex-col bg-white border border-slate-200 shadow-lg rounded-md overflow-hidden z-20 min-w-[140px]">
        <a href={googleMapsUri} target="_blank" rel="noreferrer" className="text-[11px] px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left border-b border-slate-100 flex items-center justify-between">
          <span>Google Maps</span>
        </a>
        <a href={aMapUri} target="_blank" rel="noreferrer" className="text-[11px] px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left flex items-center justify-between">
          <span>AMap (高德)</span>
        </a>
      </div>
    </div>
  );
}

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
  updatePlaceCost,
  calculatingId,
  previousPlace,
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
  updateTravelSegment: (dayId: string, uniqueId: string, segment: TravelSegment | undefined) => void;
  calculateTravelTime: (index: number, mode: 'DRIVING' | 'WALKING' | 'TRANSIT') => void;
  updatePlaceCost: (dayId: string, uniqueId: string, cost: number | undefined, currency: string | undefined) => void;
  calculatingId: string | null;
  previousPlace?: DayPlanPlace | { id: string, name: string, lat: number, lng: number };
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
                       {place.travelFromPrevious.mode === 'MANUAL' && <Pencil className="w-4 h-4 text-slate-500" />}
                    </div>
                  </div>
                  {!readOnly && (
                    <button
                      className="text-xs text-blue-500 hover:text-blue-700 underline"
                      onClick={() => updateTravelSegment(activeDayId, place.uniqueId, undefined)}
                    >
                      Change mode
                    </button>
                  )}
                </div>

                {!readOnly && place.travelFromPrevious.routeAlternatives && place.travelFromPrevious.routeAlternatives.length > 1 && (
                  <div className="flex flex-wrap gap-1 mt-1 justify-center bg-gray-50 p-1 rounded-lg">
                    {place.travelFromPrevious.routeAlternatives.map((alt, idx) =>
                      renderAlternativeBadge(
                        alt,
                        (place.travelFromPrevious!.selectedRouteIndex || 0) === idx,
                        () => {
                          updateTravelSegment(activeDayId, place.uniqueId, {
                            ...place.travelFromPrevious!,
                            durationMinutes: alt.durationMinutes,
                            selectedRouteIndex: idx,
                          });
                        }
                      )
                    )}
                  </div>
                )}
                <MapDeepLinks 
                  originLat={previousPlace?.lat} originLng={previousPlace?.lng} originName={previousPlace?.name}
                  destLat={place.lat} destLng={place.lng} destName={place.name}
                />
              </div>
            ) : (
              !readOnly && (
                <div className="flex items-center gap-2">
                   <span className="text-gray-500 text-xs mr-2">Calculate path:</span>
                   <button onClick={() => calculateTravelTime(index, 'DRIVING')} className="p-1 hover:bg-gray-100 rounded text-blue-600" disabled={calculatingId === place.uniqueId}>
                     <Car className="w-4 h-4" />
                   </button>
                   <button onClick={() => calculateTravelTime(index, 'WALKING')} className="p-1 hover:bg-gray-100 rounded text-green-600" disabled={calculatingId === place.uniqueId}>
                     <Footprints className="w-4 h-4" />
                   </button>
                   <button onClick={() => calculateTravelTime(index, 'TRANSIT')} className="p-1 hover:bg-gray-100 rounded text-orange-600" disabled={calculatingId === place.uniqueId} title="Calculate Transit">
                     <Bus className="w-4 h-4" />
                   </button>
                   <button onClick={() => {
                     const manualTime = window.prompt("Enter estimated travel time in minutes:", "15");
                     if (manualTime && !isNaN(Number(manualTime))) {
                       updateTravelSegment(activeDayId, place.uniqueId, {
                         mode: 'MANUAL',
                         durationMinutes: Number(manualTime)
                       });
                     }
                   }} className="p-1 hover:bg-gray-100 rounded text-slate-600" disabled={calculatingId === place.uniqueId} title="Manual Time (Walking)">
                     <Pencil className="w-4 h-4" />
                   </button>
                   {calculatingId === place.uniqueId && <span className="text-xs text-gray-400 animate-pulse">...</span>}
                </div>
              )
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

      <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-all relative group flex flex-col">
        <div className="flex gap-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab hover:text-slate-800 text-slate-400 mt-1 flex items-start"
          >
            <GripVertical className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg text-slate-800 truncate" title={place.name}>{place.name}</div>
                <div className="text-sm text-slate-500 truncate mt-0.5">{place.city} &bull; {place.recommendedDuration} min suggested</div>
              </div>
              {!readOnly && (
                <button
                  onClick={() => removeFromDayPlan(activeDayId, place.uniqueId)}
                  className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                  title="Remove from plan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-5 bg-slate-50 p-3 rounded-lg border border-slate-100">
              {/* Time block */}
              <div className="flex items-center gap-2">
                  {place.lockedArrivalTime ? (
                    <div className="flex items-center text-sm font-mono border border-blue-300 bg-blue-50 text-blue-700 rounded-md px-2 py-1 shadow-sm">
                      <input
                        type="time"
                        value={place.lockedArrivalTime}
                        onChange={(e) => updateLockedArrivalTime(activeDayId, place.uniqueId, e.target.value || undefined)}
                        className="bg-transparent border-none focus:ring-0 p-0 text-sm font-medium w-[72px]"
                        disabled={readOnly}
                      />
                      <button
                        onClick={() => updateLockedArrivalTime(activeDayId, place.uniqueId, undefined)}
                        className="ml-1 text-blue-400 hover:text-blue-600 focus:outline-none"
                        title="Unlock auto-calculation"
                        disabled={readOnly}
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="flex items-center text-sm font-mono text-slate-600 hover:text-blue-700 hover:bg-white rounded-md px-2 py-1 border border-transparent hover:border-slate-200 transition-all shadow-sm hover:shadow group"
                      onClick={() => updateLockedArrivalTime(activeDayId, place.uniqueId, arrivalTime)}
                      title="Click to lock this arrival time"
                      disabled={readOnly}
                    >
                      <span className="font-medium">{arrivalTime}</span>
                      {!readOnly && <LockOpen className="w-3.5 h-3.5 ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 group-hover:text-blue-400" />}
                    </button>
                  )}

                  <span className="text-slate-400 font-medium">—</span>
                  <span className="text-slate-600 font-mono text-sm font-medium px-1">{departureTime}</span>
                  
                  {isLate && (
                    <div className="flex items-center text-orange-700 text-xs font-semibold ml-1 bg-orange-100 px-2 py-1 rounded-md border border-orange-200 shadow-sm" title={`Projected arrival: ${minutesToTime(projectedArrivalMinutes)}`}>
                      <AlertCircle className="w-3.5 h-3.5 mr-1" />
                      Late
                    </div>
                  )}
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-px h-5 bg-slate-200"></div>

              {/* Inputs block */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Duration</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={place.userDuration}
                      onChange={(e) => updatePlaceDuration(activeDayId, place.uniqueId, Number(e.target.value) || 0)}
                      className="w-[72px] text-sm font-medium text-slate-700 border-slate-200 rounded-md px-2 py-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      disabled={readOnly}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">min</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cost</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      value={place.cost || ''}
                      onChange={(e) => updatePlaceCost(activeDayId, place.uniqueId, e.target.value ? Number(e.target.value) : undefined, place.currency || 'USD')}
                      placeholder="0.00"
                      className="w-[84px] text-sm font-medium text-slate-700 border-slate-200 rounded-md px-2 py-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      disabled={readOnly}
                    />
                    <select
                      value={place.currency || 'USD'}
                      onChange={(e) => updatePlaceCost(activeDayId, place.uniqueId, place.cost, e.target.value)}
                      className="text-sm font-medium text-slate-700 border-slate-200 rounded-md pl-2 pr-7 py-1 bg-white focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      disabled={readOnly}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="RUB">RUB (₽)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="JPY">JPY (¥)</option>
                      <option value="CNY">CNY (¥)</option>
                    </select>
                  </div>
                </div>
              </div>
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
  const { triplist, days, activeDayId, setActiveDay, addDay, removeDay, updatePlaceDuration, removeFromDayPlan, updateTravelSegment, reorderDayPlan, setStartHotel, setEndHotel, updateEndHotelTravel, updateLockedArrivalTime, setDayStartTime, updatePlaceCost } = useTripStore();
  const [calculatingId, setCalculatingId] = useState<string | null>(null);
  const [showFlightModal, setShowFlightModal] = useState(false);
  const [editingFlight, setEditingFlight] = useState<DayPlanPlace | undefined>(undefined);

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
    if (!GOOGLE_MAPS_API_KEY || !window.google) {
      const manualTime = window.prompt(`Enter estimated travel time in minutes (${mode}):`, "15");
      if (manualTime && !isNaN(Number(manualTime))) {
        updateTravelSegment(activeDay.id, dayPlan[index].uniqueId, {
          mode,
          durationMinutes: Number(manualTime)
        });
      }
      return;
    }

    let origin: any, destination: any, isEndHotel = false;

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
      // Resolve lat/lng for flights
      let originLat = origin.lat;
      let originLng = origin.lng;
      if (origin.type === 'FLIGHT' && origin.flightDetails) {
         const airport = getAirportLocation(origin.flightDetails.arrivalAirport);
         if (airport) {
           originLat = airport.lat;
           originLng = airport.lng;
         }
      }

      let destLat = destination.lat;
      let destLng = destination.lng;
      if (destination.type === 'FLIGHT' && destination.flightDetails) {
         const airport = getAirportLocation(destination.flightDetails.departureAirport);
         if (airport) {
           destLat = airport.lat;
           destLng = airport.lng;
         }
      }

      const routingModeMap: Record<'DRIVING' | 'WALKING' | 'TRANSIT', 'DRIVE' | 'WALK' | 'TRANSIT'> = {
        'DRIVING': 'DRIVE',
        'WALKING': 'WALK',
        'TRANSIT': 'TRANSIT',
      };

      const requestBody: ComputeRouteRequest & { source?: string } = {
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
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
        const routeAlternatives = data.routes.map((route: Route, index: number) => {
          const durationSeconds = parseInt(route.duration.replace('s', ''), 10);

          let summary = route.description || `Option ${index + 1}`;
          let transitBadges: TransitBadge[] = [];
          let steps: RouteStep[] = [];

          if (route.legs) {
            route.legs.forEach((leg: RouteLeg) => {
              if (leg.steps) {
                leg.steps.forEach((step: RouteStepDetail) => {
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
           updateEndHotelTravel(activeDay.id, fallbackData);
        } else {
           updateTravelSegment(activeDay.id, (destination as DayPlanPlace).uniqueId, fallbackData);
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
    <div className="flex flex-col h-full bg-white">
      {/* Day Selector */}
      <div className="flex items-center gap-2 p-4 border-b bg-gray-50 overflow-x-auto scrollbar-hide">
        {days.map((day, idx) => (
          <button
            key={day.id}
            onClick={() => setActiveDay(day.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors border ${
              activeDay.id === day.id
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            Day {idx + 1}
          </button>
        ))}
        {!readOnly && (
          <button
            onClick={addDay}
            className="p-1.5 rounded-full bg-white border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
            title="Add new day"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-800">Plan for Day</h2>
            {!readOnly && days.length > 1 && (
              <button onClick={() => removeDay(activeDay.id)} className="text-red-400 hover:text-red-600 p-1" title="Delete current day">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {!readOnly && (
              <button
                onClick={() => {
                  setEditingFlight(undefined);
                  setShowFlightModal(true);
                }}
                className="ml-2 text-xs font-semibold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors shadow-sm"
              >
                + Add Flight
              </button>
            )}
          </div>
          <div className="flex items-center space-x-2 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
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
      {/* Render Flights at the top */}
      {activeDay.flights && activeDay.flights.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">Scheduled Flights</h3>
          {activeDay.flights.map(flight => (
            <FlightCard
              key={flight.uniqueId}
              flight={flight}
              readOnly={readOnly}
              onEdit={() => {
                setEditingFlight(flight);
                setShowFlightModal(true);
              }}
              onRemove={() => useTripStore.getState().removeFlight(activeDay.id, flight.uniqueId)}
            />
          ))}
        </div>
      )}

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
                let travelTime = 0;
                if (index > 0) {
                   travelTime = place.travelFromPrevious?.durationMinutes || 0;
                } else if (index === 0 && activeDay.startHotelId) {
                   travelTime = place.travelFromPrevious?.durationMinutes || 0;
                }

                currentMinutes += travelTime;

                const projectedArrival = currentMinutes;
                let actualArrival = currentMinutes;
                let departureMinutes = currentMinutes + place.userDuration;

                if (place.lockedArrivalTime) {
                   const lockedMins = timeToMinutes(place.lockedArrivalTime);
                   actualArrival = lockedMins;
                   departureMinutes = lockedMins + place.userDuration;
                }
                currentMinutes = departureMinutes;

                const originPlace = index === 0 && activeDay.startHotelId 
                  ? triplist.find(p => p.id === activeDay.startHotelId) 
                  : index > 0 ? dayPlan[index - 1] : undefined;

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
                    updatePlaceCost={updatePlaceCost}
                    previousPlace={originPlace}
                    readOnly={readOnly}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Warning if itinerary runs late for any flight */}
      {!readOnly && activeDay.flights?.map(flight => {
        if (!flight.flightDetails) return null;
        const depTimeMins = timeToMinutes(flight.flightDetails.departureTime || '12:00');
        const bufferMins = (flight.flightDetails.bufferHours || 2) * 60;
        const requiredArrival = depTimeMins - bufferMins;
        if (currentMinutes > requiredArrival) {
          return (
            <div key={`warning-${flight.uniqueId}`} className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-red-800">You might miss your flight!</h4>
                <p className="text-xs text-red-600 mt-1">
                  Your itinerary ends at {minutesToTime(currentMinutes)}, but you need to be at {flight.flightDetails.departureAirport} by {minutesToTime(requiredArrival)}.
                </p>
              </div>
            </div>
          );
        }
        return null;
      })}


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
            <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-2 flex flex-col gap-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-gray-500">Travel to end hotel:</span>
                {activeDay.endHotelTravel ? (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">{activeDay.endHotelTravel.durationMinutes} min</span>
                    <div className="flex gap-1 text-gray-400">
                       {activeDay.endHotelTravel.mode === 'DRIVING' && <Car className="w-4 h-4 text-blue-500" />}
                       {activeDay.endHotelTravel.mode === 'WALKING' && <Footprints className="w-4 h-4 text-green-500" />}
                       {activeDay.endHotelTravel.mode === 'TRANSIT' && <Bus className="w-4 h-4 text-orange-500" />}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs italic text-gray-400">Not calculated</span>
                )}
              </div>
              
              {activeDay.endHotelTravel ? (
                  <div className="flex flex-col w-full">
                    <div className="flex justify-end gap-2 items-center px-1">
                      {!readOnly && (
                        <button
                          className="text-xs text-blue-500 hover:text-blue-700 underline"
                          onClick={() => updateEndHotelTravel(activeDay.id, undefined)}
                        >
                          Change mode
                        </button>
                      )}
                    </div>
                    {activeDay.endHotelTravel.routeAlternatives && activeDay.endHotelTravel.routeAlternatives.length > 1 && !readOnly && (
                      <div className="flex flex-wrap gap-1 mt-2 justify-end">
                         {/* alternatives logic is simplified for end hotel in this view for now */}
                      </div>
                    )}
                    <MapDeepLinks 
                      originLat={dayPlan.length > 0 ? dayPlan[dayPlan.length - 1].lat : undefined}
                      originLng={dayPlan.length > 0 ? dayPlan[dayPlan.length - 1].lng : undefined}
                      originName={dayPlan.length > 0 ? dayPlan[dayPlan.length - 1].name : undefined}
                      destLat={triplist.find(p => p.id === activeDay.endHotelId)?.lat}
                      destLng={triplist.find(p => p.id === activeDay.endHotelId)?.lng}
                      destName={triplist.find(p => p.id === activeDay.endHotelId)?.name}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 justify-end px-1">
                    <span className="text-gray-500 text-xs mr-1">Calculate:</span>
                    <button onClick={() => calculateTravelTime(-1, 'DRIVING')} className="p-1 hover:bg-gray-200 rounded text-blue-600" disabled={calculatingId === 'end-hotel'}>
                      <Car className="w-4 h-4" />
                    </button>
                    <button onClick={() => calculateTravelTime(-1, 'WALKING')} className="p-1 hover:bg-gray-200 rounded text-green-600" disabled={calculatingId === 'end-hotel'}>
                      <Footprints className="w-4 h-4" />
                    </button>
                    <button onClick={() => calculateTravelTime(-1, 'TRANSIT')} className="p-1 hover:bg-gray-200 rounded text-orange-600" disabled={calculatingId === 'end-hotel'} title="Calculate Transit">
                      <Bus className="w-4 h-4" />
                    </button>
                    <button onClick={() => {
                       const manualTime = window.prompt("Enter estimated travel time in minutes:", "15");
                       if (manualTime && !isNaN(Number(manualTime))) {
                         updateEndHotelTravel(activeDay.id, {
                           mode: 'MANUAL',
                           durationMinutes: Number(manualTime)
                         });
                       }
                    }} className="p-1 hover:bg-gray-200 rounded text-slate-600" disabled={calculatingId === 'end-hotel'} title="Manual Time (Walking)">
                      <Pencil className="w-4 h-4" />
                    </button>
                    {calculatingId === 'end-hotel' && <span className="text-xs text-gray-400 animate-pulse">...</span>}
                    {(!readOnly) && (
                      <div className="ml-2 pl-2 border-l border-gray-200">
                        <MapDeepLinks 
                          originLat={dayPlan.length > 0 ? dayPlan[dayPlan.length - 1].lat : undefined}
                          originLng={dayPlan.length > 0 ? dayPlan[dayPlan.length - 1].lng : undefined}
                          originName={dayPlan.length > 0 ? dayPlan[dayPlan.length - 1].name : undefined}
                          destLat={triplist.find(p => p.id === activeDay.endHotelId)?.lat}
                          destLng={triplist.find(p => p.id === activeDay.endHotelId)?.lng}
                          destName={triplist.find(p => p.id === activeDay.endHotelId)?.name}
                        />
                      </div>
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {/* Inline Search moved below the itinerary */}
      {!readOnly && (
        <div className="mt-6 pt-4 border-t border-gray-200">
           <InlineSearch dayId={activeDay.id} />
           <SmartSuggestions dayId={activeDay.id} />
        </div>
      )}

      {showFlightModal && (
        <AddFlightModal 
          dayId={activeDay.id} 
          existingFlight={editingFlight}
          onClose={() => {
            setShowFlightModal(false);
            setEditingFlight(undefined);
          }} 
        />
      )}
    </div>
  </div>
  );
}

