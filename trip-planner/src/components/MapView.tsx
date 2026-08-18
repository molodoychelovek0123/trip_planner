import { useEffect, useRef, useState, useMemo } from 'react';
import { useTripStore } from '../store';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { MapContextMenu } from './MapContextMenu';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

/**
 * Renders the Google Map utilizing the `@googlemaps/js-api-loader`.
 * Visualizes saved places (Triplist) as gray dots, and DayPlan places as numbered blue pins.
 * Decodes and renders multi-segment polylines for calculated routes.
 */
interface ContextMenuMouseEvent extends google.maps.MapMouseEvent {
  pixel?: { x: number; y: number };
}

export function MapView({ readOnly = false }: { readOnly?: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    position: { x: 0, y: 0 },
    latLng: null as { lat: number, lng: number } | null
  });

  const { days, activeDayId, triplist } = useTripStore();
  const activeDay = days.find(d => d.id === activeDayId) || days[0];
  const dayPlan = activeDay?.plan || [];
  const flights = activeDay?.flights || [];

  // Create a geo hash to avoid re-rendering map when costs or durations change
  const geoHash = useMemo(() => {
    const sTrip = triplist.map(p => `${p.id}:${p.lat}:${p.lng}`);
    const sPlan = dayPlan.map(p => `${p.id}:${p.lat}:${p.lng}:${p.travelFromPrevious?.durationMinutes || 0}:${p.travelFromPrevious?.mode || ''}`);
    const sFlights = flights.map(p => `${p.uniqueId}:${p.lat}:${p.lng}`);
    return JSON.stringify({ activeDayId, sTrip, sPlan, sFlights });
  }, [triplist, dayPlan, flights, activeDayId]);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn("Google Maps API Key missing for map view.");
      return;
    }

    setOptions({
      key: GOOGLE_MAPS_API_KEY,
      v: "weekly"
    });

    let isMounted = true;

    importLibrary('maps').then((mapsLibrary) => {
      // Import geometry library for decoding polylines
      importLibrary('geometry').catch(err => console.error("Failed to load geometry library", err));

      if (!isMounted) return;

      const newMap = new mapsLibrary.Map(mapRef.current as HTMLElement, {
        center: { lat: 0, lng: 0 },
        zoom: 2,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      setMap(newMap);

      // Add right-click listener
      newMap.addListener('contextmenu', (e: ContextMenuMouseEvent) => {
        if (readOnly) return;
        if (e.latLng && e.pixel) {
           setContextMenu({
             isOpen: true,
             position: { x: e.pixel.x, y: e.pixel.y },
             latLng: { lat: e.latLng.lat(), lng: e.latLng.lng() }
           });
        }
      });

      // Close context menu on click or drag
      newMap.addListener('click', () => setContextMenu(prev => ({ ...prev, isOpen: false })));
      newMap.addListener('dragstart', () => setContextMenu(prev => ({ ...prev, isOpen: false })));

    }).catch(err => {
      console.error("Failed to load map:", err);
    });

    return () => {
      isMounted = false;
      if (map) {
         window.google.maps.event.clearInstanceListeners(map);
      }
    };
  }, []);

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
    // Guards against stale cached data or partial server payloads where
    // lat/lng may be undefined/null/NaN.
    const hasValidCoords = (p: { lat?: number | null, lng?: number | null } | undefined): boolean =>
      !!p && typeof p.lat === 'number' && typeof p.lng === 'number' &&
      Number.isFinite(p.lat) && Number.isFinite(p.lng);

    // Add triplist markers (smaller, gray)
    triplist.forEach((place) => {
      // Skip if already in dayPlan
      if (dayPlan.some(p => p.id === place.id)) return;
      if (!hasValidCoords(place)) return;

      const marker = new window.google.maps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map: mapInstance,
        title: place.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#9CA3AF', // Tailwind gray-400
          fillOpacity: 0.8,
          strokeColor: '#fff',
          strokeWeight: 1,
          scale: 6,
        }
      });
      markersRef.current.push(marker);
      bounds.extend({ lat: place.lat, lng: place.lng });
      hasPoints = true;
    });

    // Add day plan markers (larger, numbered).
    // Filter out points without valid coordinates so Google Maps never
    // receives undefined/NaN (which previously caused setPosition errors).
    const validDayPlan = dayPlan.filter(hasValidCoords);
    const validFlights = flights.filter(hasValidCoords);

    validDayPlan.forEach((place, index) => {
      const marker = new window.google.maps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map: mapInstance,
        title: place.name,
        label: {
          text: (index + 1).toString(),
          color: '#ffffff',
          fontWeight: 'bold'
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#3B82F6', // Tailwind blue-500
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 12,
        }
      });
      markersRef.current.push(marker);
      bounds.extend({ lat: place.lat, lng: place.lng });
      hasPoints = true;
    });

    validFlights.forEach((flight) => {
      const marker = new window.google.maps.Marker({
        position: { lat: flight.lat, lng: flight.lng },
        map: mapInstance,
        title: flight.name,
        icon: {
          path: "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z",
          fillColor: '#8B5CF6', // Purple for flights
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 1,
          scale: 1,
          anchor: new window.google.maps.Point(12, 12)
        }
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

        // Add a warning marker in the middle
        let midPoint = { lat: (prev.lat + current.lat) / 2, lng: (prev.lng + current.lng) / 2 };
        if (window.google?.maps?.geometry?.spherical) {
          const p1 = new window.google.maps.LatLng(prev.lat, prev.lng);
          const p2 = new window.google.maps.LatLng(current.lat, current.lng);
          const mid = window.google.maps.geometry.spherical.interpolate(p1, p2, 0.5);
          midPoint = { lat: mid.lat(), lng: mid.lng() };
        }

        const warningMarker = new window.google.maps.Marker({
          position: midPoint,
          map: mapInstance,
          title: "Маршрут не построен",
          icon: {
            path: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z", // Warning triangle SVG
            fillColor: '#F59E0B', // Amber-500
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 1,
            scale: 1,
            anchor: new window.google.maps.Point(12, 21),
          },
          zIndex: 100,
        });
        
        markersRef.current.push(warningMarker);
      }

      const fallbackPolyline = new window.google.maps.Polyline(polylineOptions);
      polylinesRef.current.push(fallbackPolyline);
    }

    if (hasPoints) {
      if (validDayPlan.length === 1 && triplist.length === 0) {
        // If only one point, set center and zoom
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, geoHash]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapRef} className="w-full h-full bg-gray-200" />

      <MapContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        latLng={contextMenu.latLng}
        onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
      />

      {!GOOGLE_MAPS_API_KEY && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 bg-opacity-80">
          <div className="bg-white p-4 rounded-lg shadow-md text-center">
            <p className="text-gray-700 font-medium">Map View Unavailable</p>
            <p className="text-sm text-gray-500 mt-1">Provide a Google Maps API Key to see the map.</p>
          </div>
        </div>
      )}
    </div>
  );
}
