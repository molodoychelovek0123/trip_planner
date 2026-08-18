import { useEffect, useRef } from 'react';
import type { Place, DayPlanPlace } from '../types';

interface UseMapRenderProps {
  map: google.maps.Map | null;
  geoHash: string;
  triplist: Place[];
  dayPlan: DayPlanPlace[];
  flights: DayPlanPlace[];
}

export function useMapRender({ map, geoHash, triplist, dayPlan, flights }: UseMapRenderProps) {
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!map || !window.google) return;
    const mapInstance = map;

    // Clear existing markers and polylines
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;

    // Defensive helper: only treat numbers as valid coordinates.
    const hasValidCoords = (p: { lat?: number | null, lng?: number | null } | undefined): boolean =>
      !!p && typeof p.lat === 'number' && typeof p.lng === 'number' &&
      Number.isFinite(p.lat) && Number.isFinite(p.lng);

    // We need to load marker library to use AdvancedMarkerElement and PinElement
    let isCancelled = false;

    (async () => {
      let AdvancedMarkerElement: any;
      let PinElement: any;
      
      try {
        const markerLib = await window.google.maps.importLibrary("marker") as any;
        AdvancedMarkerElement = markerLib.AdvancedMarkerElement;
        PinElement = markerLib.PinElement;
      } catch (e) {
        console.error("Failed to load marker library", e);
        return;
      }

      if (isCancelled) return;

      // Add triplist markers (smaller, gray)
      triplist.forEach((place) => {
        // Skip if already in dayPlan
        if (dayPlan.some(p => p.id === place.id)) return;
        if (!hasValidCoords(place)) return;

        const pin = new PinElement({
          background: '#9CA3AF',
          borderColor: '#ffffff',
          glyph: '',
          scale: 0.6,
        });

        const marker = new AdvancedMarkerElement({
          position: { lat: place.lat, lng: place.lng },
          map: mapInstance,
          title: place.name,
          content: pin.element
        });
        markersRef.current.push(marker);
        bounds.extend({ lat: place.lat, lng: place.lng });
        hasPoints = true;
      });

      // Add day plan markers (larger, numbered).
      const validDayPlan = dayPlan.filter(hasValidCoords);
      const validFlights = flights.filter(hasValidCoords);

      validDayPlan.forEach((place, index) => {
        const pin = new PinElement({
          background: '#3B82F6',
          borderColor: '#ffffff',
          glyphColor: '#ffffff',
          glyph: (index + 1).toString(),
          scale: 1.1,
        });

        const marker = new AdvancedMarkerElement({
          position: { lat: place.lat, lng: place.lng },
          map: mapInstance,
          title: place.name,
          content: pin.element
        });
        markersRef.current.push(marker);
        bounds.extend({ lat: place.lat, lng: place.lng });
        hasPoints = true;
      });

      validFlights.forEach((flight) => {
        // We use a custom HTML element for the flight icon instead of PinElement
        // to match the exact SVG icon we had before
        const flightDiv = document.createElement("div");
        flightDiv.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="#8B5CF6" stroke="#ffffff" stroke-width="1"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;
        flightDiv.style.transform = "translate(0, 12px)"; // Center vertically on coordinate

        const marker = new AdvancedMarkerElement({
          position: { lat: flight.lat, lng: flight.lng },
          map: mapInstance,
          title: flight.name,
          content: flightDiv
        });
        markersRef.current.push(marker);
        bounds.extend({ lat: flight.lat, lng: flight.lng });
        hasPoints = true;
      });

      // Draw route polylines
      for (let i = 1; i < validDayPlan.length; i++) {
        const prev = validDayPlan[i - 1];
        const current = validDayPlan[i];
        const segment = current.travelFromPrevious;

        if (segment && segment.routeAlternatives && segment.routeAlternatives.length > 0) {
          const selectedRoute = segment.routeAlternatives[segment.selectedRouteIndex || 0];

          if (selectedRoute.steps && selectedRoute.steps.length > 0 && window.google.maps.geometry?.encoding) {
            // Draw each step individually
            selectedRoute.steps.forEach((step) => {
              const path = window.google.maps.geometry.encoding.decodePath(step.encodedPolyline);
              const isWalk = step.travelMode === 'WALK';

              const polylineOptions: google.maps.PolylineOptions = {
                path: path,
                geodesic: true,
                map: mapInstance,
                strokeWeight: 4,
              };

              if (isWalk) {
                polylineOptions.strokeOpacity = 0;
                polylineOptions.icons = [{
                  icon: {
                    path: 'M 0,-1 0,1',
                    strokeOpacity: 1,
                    scale: 2,
                    strokeColor: '#9CA3AF' // Gray for walk
                  },
                  offset: '0',
                  repeat: '10px'
                }];
              } else {
                polylineOptions.strokeColor = step.color || '#3B82F6'; // Use line color or default blue
                polylineOptions.strokeOpacity = 0.8;
              }

              const polyline = new window.google.maps.Polyline(polylineOptions);
              polylinesRef.current.push(polyline);
            });
            continue; // Skip fallback
          }
        }

        // Fallback to straight line (geodesic) if no route calculated or geometry library not loaded
        const fallbackPath = [
          { lat: prev.lat, lng: prev.lng },
          { lat: current.lat, lng: current.lng }
        ];

        const isManual = segment?.mode === 'MANUAL';

        const polylineOptions: google.maps.PolylineOptions = {
          path: fallbackPath,
          geodesic: true,
          map: mapInstance,
          strokeWeight: 3,
        };

        if (isManual) {
          polylineOptions.strokeOpacity = 0;
          polylineOptions.icons = [{
            icon: {
              path: 'M 0,-1 0,1',
              strokeOpacity: 1,
              scale: 2,
              strokeColor: '#9CA3AF' // Gray for walk/manual
            },
            offset: '0',
            repeat: '10px'
          }];
        } else {
          // Semi-transparent line for missing route
          polylineOptions.strokeColor = '#EF4444'; // Red-500
          polylineOptions.strokeOpacity = 0.4;
          polylineOptions.strokeWeight = 4;
          polylineOptions.geodesic = false; // Make it a straight line on the projection as requested ("прямой")
        }

        const fallbackPolyline = new window.google.maps.Polyline(polylineOptions);
        polylinesRef.current.push(fallbackPolyline);
      }

      // After adding markers asynchronously, we might need to adjust bounds again if this is the first load
      if (hasPoints) {
        if (validDayPlan.length === 1 && triplist.length === 0) {
          mapInstance.setCenter({ lat: validDayPlan[0].lat, lng: validDayPlan[0].lng });
          mapInstance.setZoom(14);
        } else {
          mapInstance.fitBounds(bounds);
          // Prevent zooming in too much
          const listener = window.google.maps.event.addListener(mapInstance, 'idle', () => {
            const zoom = mapInstance.getZoom();
            if (zoom !== null && zoom !== undefined && zoom > 15) mapInstance.setZoom(15);
            window.google.maps.event.removeListener(listener);
          });
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [map, geoHash]);
}
