import { useState } from 'react';
import type { DayData, DayPlanPlace, Place, TransitBadge, RouteStep } from '../types';
import type { ComputeRouteRequest, Route, RouteLeg, RouteStepDetail } from '../types/googleRoutes';
import { getAirportLocation } from '../utils/airports';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface UseTravelCalculationProps {
  triplist: Place[];
  updateTravelSegment: (dayId: string, uniqueId: string, segment: any) => void;
  updateEndHotelTravel: (dayId: string, segment: any) => void;
}

export function useTravelCalculation({ triplist, updateTravelSegment, updateEndHotelTravel }: UseTravelCalculationProps) {
  const [calculatingId, setCalculatingId] = useState<string | null>(null);

  const calculateTravelTime = async (
    activeDay: DayData,
    dayPlan: DayPlanPlace[],
    index: number,
    mode: 'DRIVING' | 'WALKING' | 'TRANSIT'
  ) => {
    if (!GOOGLE_MAPS_API_KEY || !window.google) {
      const manualTime = window.prompt(`Enter estimated travel time in minutes (${mode}):`, "15");
      if (manualTime && !isNaN(Number(manualTime))) {
        if (index === -1) {
          updateEndHotelTravel(activeDay.id, { mode, durationMinutes: Number(manualTime) });
        } else {
          updateTravelSegment(activeDay.id, dayPlan[index].uniqueId, {
            mode,
            durationMinutes: Number(manualTime)
          });
        }
      }
      return;
    }

    let origin: any, destination: any, isEndHotel = false;

    if (index === -1) {
       origin = dayPlan[dayPlan.length - 1];
       const hotel = triplist.find(p => p.id === activeDay.endHotelId);
       if (!hotel) return;
       destination = hotel;
       isEndHotel = true;
       setCalculatingId('end-hotel');
    } else {
       origin = index === 0 ? triplist.find(p => p.id === activeDay.startHotelId) : dayPlan[index - 1];
       destination = dayPlan[index];
       if (!origin || !destination) return;
       setCalculatingId(destination.uniqueId);
    }

    try {
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
        const routeAlternatives = data.routes.map((route: Route, rIndex: number) => {
          const durationSeconds = parseInt(route.duration.replace('s', ''), 10);

          let summary = route.description || `Option ${rIndex + 1}`;
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

  return { calculatingId, calculateTravelTime };
}
