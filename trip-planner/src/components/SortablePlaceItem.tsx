import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Car, Footprints, Bus, GripVertical, AlertCircle, LockOpen, Lock, Trash2, Pencil } from 'lucide-react';
import type { DayPlanPlace, TravelSegment, RouteAlternative } from '../types';
import { MapDeepLinks } from './MapDeepLinks';

export function SortablePlaceItem({
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
      case 'METRO_RAIL': return <span className="mr-0.5">🚇</span>;
      case 'TRAM': return <span className="mr-0.5">🚋</span>;
      case 'TROLLEYBUS': return <span className="mr-0.5">🚎</span>;
      case 'BUS':
      case 'INTERCITY_BUS': return <span className="mr-0.5">🚌</span>;
      case 'COMMUTER_TRAIN':
      case 'HEAVY_RAIL':
      case 'HIGH_SPEED_TRAIN':
      case 'RAIL': return <span className="mr-0.5">🚆</span>;
      case 'FERRY': return <span className="mr-0.5">⛴️</span>;
      case 'CABLE_CAR':
      case 'GONDOLA': return <span className="mr-0.5">🚠</span>;
      case 'FUNICULAR': return <span className="mr-0.5">🚞</span>;
      case 'MONORAIL': return <span className="mr-0.5">🚝</span>;
      default: return <span className="mr-0.5">🚌</span>;
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
      {(index > 0 || (index === 0 && startHotelId)) && (
        <div className="flex items-center justify-center my-2 relative">
          <div className="absolute left-1/2 -ml-px w-0.5 h-full bg-gray-200" aria-hidden="true"></div>
          <div className="relative z-10 bg-white p-2 border rounded-xl text-sm flex flex-col items-center gap-2 shadow-sm min-w-[200px]">
            {place.travelFromPrevious ? (
              <div className="flex flex-col w-full">
                <div className="flex items-center justify-between px-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 font-semibold">{place.travelFromPrevious.durationMinutes} min</span>
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
                   <button onClick={() => calculateTravelTime(index, 'TRANSIT')} className="p-1 hover:bg-gray-100 rounded text-orange-600" disabled={calculatingId === place.uniqueId}>
                     <Bus className="w-4 h-4" />
                   </button>
                   <button onClick={() => {
                     const manualTime = window.prompt("Enter estimated travel time in minutes:", "15");
                     if (manualTime && !isNaN(Number(manualTime))) {
                       updateTravelSegment(activeDayId, place.uniqueId, { mode: 'MANUAL', durationMinutes: Number(manualTime) });
                     }
                   }} className="p-1 hover:bg-gray-100 rounded text-slate-600" disabled={calculatingId === place.uniqueId}>
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
          <div {...attributes} {...listeners} className="cursor-grab hover:text-slate-800 text-slate-400 mt-1 flex items-start">
            <GripVertical className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg text-slate-800 truncate" title={place.name}>{place.name}</div>
                <div className="text-sm text-slate-500 truncate mt-0.5">{place.city} &bull; {place.recommendedDuration} min suggested</div>
              </div>
              {!readOnly && (
                <button onClick={() => removeFromDayPlan(activeDayId, place.uniqueId)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0" title="Remove from plan">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-5 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="flex items-center gap-2">
                  {place.lockedArrivalTime ? (
                    <div className="flex items-center text-sm font-mono border border-blue-300 bg-blue-50 text-blue-700 rounded-md px-2 py-1 shadow-sm">
                      <input type="time" value={place.lockedArrivalTime} onChange={(e) => updateLockedArrivalTime(activeDayId, place.uniqueId, e.target.value || undefined)} className="bg-transparent border-none focus:ring-0 p-0 text-sm font-medium w-[72px]" disabled={readOnly} />
                      <button onClick={() => updateLockedArrivalTime(activeDayId, place.uniqueId, undefined)} className="ml-1 text-blue-400 hover:text-blue-600 focus:outline-none" title="Unlock auto-calculation" disabled={readOnly}>
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button className="flex items-center text-sm font-mono text-slate-600 hover:text-blue-700 hover:bg-white rounded-md px-2 py-1 border border-transparent hover:border-slate-200 transition-all shadow-sm hover:shadow group" onClick={() => updateLockedArrivalTime(activeDayId, place.uniqueId, arrivalTime)} title="Click to lock this arrival time" disabled={readOnly}>
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

              <div className="hidden sm:block w-px h-5 bg-slate-200"></div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Duration</label>
                  <div className="relative">
                    <input type="number" min="0" step="5" value={place.userDuration} onChange={(e) => updatePlaceDuration(activeDayId, place.uniqueId, Number(e.target.value) || 0)} className="w-[72px] text-sm font-medium text-slate-700 border-slate-200 rounded-md px-2 py-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm" disabled={readOnly} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">min</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cost</label>
                  <div className="flex items-center gap-1.5">
                    <input type="number" min="0" value={place.cost || ''} onChange={(e) => updatePlaceCost(activeDayId, place.uniqueId, e.target.value ? Number(e.target.value) : undefined, place.currency || 'USD')} placeholder="0.00" className="w-[84px] text-sm font-medium text-slate-700 border-slate-200 rounded-md px-2 py-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm" disabled={readOnly} />
                    <select value={place.currency || 'USD'} onChange={(e) => updatePlaceCost(activeDayId, place.uniqueId, place.cost, e.target.value)} className="text-sm font-medium text-slate-700 border-slate-200 rounded-md pl-2 pr-7 py-1 bg-white focus:ring-blue-500 focus:border-blue-500 shadow-sm" disabled={readOnly}>
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
