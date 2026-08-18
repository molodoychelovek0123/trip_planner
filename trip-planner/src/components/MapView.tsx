import { useEffect, useRef, useState, useMemo } from 'react';
import { useTripStore } from '../store';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { MapContextMenu } from './MapContextMenu';
import { useMapRender } from '../hooks/useMapRender';

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
      // Import marker library for AdvancedMarkerElement
      importLibrary('marker').catch(err => console.error("Failed to load marker library", err));

      if (!isMounted) return;

      const newMap = new mapsLibrary.Map(mapRef.current as HTMLElement, {
        center: { lat: 0, lng: 0 },
        zoom: 2,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        mapId: "DEMO_MAP_ID", // Required for AdvancedMarkerElement
      });

      setMap(newMap);

      // Add right-click listener
      newMap.addListener('contextmenu', (e: any) => {
        if (readOnly) return;
        if (e.latLng && e.domEvent) {
           setContextMenu({
             isOpen: true,
             position: { x: e.domEvent.clientX, y: e.domEvent.clientY },
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

  useMapRender({ map, geoHash, triplist, dayPlan, flights });

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
