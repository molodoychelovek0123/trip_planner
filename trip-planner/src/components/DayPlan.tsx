import { useState } from 'react';
import { useTripStore, type DayPlanPlace } from '../store';
import { Plus, Trash2, Clock, Hotel, AlertCircle, Car, Footprints, Bus, Pencil } from 'lucide-react';
import { SmartSuggestions } from './SmartSuggestions';
import { InlineSearch } from './InlineSearch';
import { AddFlightModal } from './AddFlightModal';
import { FlightCard } from './FlightCard';
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
} from '@dnd-kit/sortable';


import { MapDeepLinks } from './MapDeepLinks';
import { SortablePlaceItem } from './SortablePlaceItem';
import { useTravelCalculation } from '../hooks/useTravelCalculation';

/**
 * Main component for assembling and managing the itinerary of a specific day.
 * Includes drag-and-drop, hotel selection, and cascading time calculations.
 */
export function DayPlan({ readOnly = false }: { readOnly?: boolean }) {
  const { triplist, days, activeDayId, setActiveDay, addDay, removeDay, updatePlaceDuration, removeFromDayPlan, updateTravelSegment, reorderDayPlan, setStartHotel, setEndHotel, updateEndHotelTravel, updateLockedArrivalTime, setDayStartTime, updatePlaceCost } = useTripStore();
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

  const { calculatingId, calculateTravelTime: doCalculateTravelTime } = useTravelCalculation({
    triplist, updateTravelSegment, updateEndHotelTravel
  });

  const calculateTravelTime = (index: number, mode: 'DRIVING' | 'WALKING' | 'TRANSIT') => {
    return doCalculateTravelTime(activeDay, dayPlan, index, mode);
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

