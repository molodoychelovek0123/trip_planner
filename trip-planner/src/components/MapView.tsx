import { useEffect, useRef, useState } from 'react';
import { useTripStore } from '../store';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);

  const { dayPlan, triplist } = useTripStore();

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
      if (!isMounted) return;

      const newMap = new mapsLibrary.Map(mapRef.current as HTMLElement, {
        center: { lat: 0, lng: 0 },
        zoom: 2,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      setMap(newMap);
    }).catch(err => {
      console.error("Failed to load map:", err);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!map || !(window as any).google) return;

    // Clear existing markers and polylines
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];

    const bounds = new (window as any).google.maps.LatLngBounds();
    let hasPoints = false;

    // Add triplist markers (smaller, gray)
    triplist.forEach((place) => {
      // Skip if already in dayPlan
      if (dayPlan.some(p => p.id === place.id)) return;

      const marker = new (window as any).google.maps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map: map,
        title: place.name,
        icon: {
          path: (window as any).google.maps.SymbolPath.CIRCLE,
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

    // Add day plan markers (larger, numbered)
    const routeCoordinates: { lat: number, lng: number }[] = [];

    dayPlan.forEach((place, index) => {
      routeCoordinates.push({ lat: place.lat, lng: place.lng });

      const marker = new (window as any).google.maps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map: map,
        title: place.name,
        label: {
          text: (index + 1).toString(),
          color: 'white',
          fontWeight: 'bold',
        },
        icon: {
          path: (window as any).google.maps.SymbolPath.CIRCLE,
          fillColor: '#3B82F6', // Tailwind blue-500
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
          scale: 12,
        }
      });
      markersRef.current.push(marker);
      bounds.extend({ lat: place.lat, lng: place.lng });
      hasPoints = true;
    });

    // Draw route polylines
    if (routeCoordinates.length > 1) {
      const polyline = new (window as any).google.maps.Polyline({
        path: routeCoordinates,
        geodesic: true,
        strokeColor: '#60A5FA', // Tailwind blue-400
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: map
      });
      polylinesRef.current.push(polyline);
    }

    if (hasPoints) {
      if (dayPlan.length === 1 && triplist.length === 0) {
        // If only one point, set center and zoom
        map.setCenter({ lat: dayPlan[0].lat, lng: dayPlan[0].lng });
        map.setZoom(14);
      } else {
        map.fitBounds(bounds);
        // Prevent zooming in too much
        const listener = (window as any).google.maps.event.addListener(map, 'idle', () => {
          if (map.getZoom() > 15) map.setZoom(15);
          (window as any).google.maps.event.removeListener(listener);
        });
      }
    }
  }, [map, dayPlan, triplist]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapRef} className="w-full h-full bg-gray-200" />
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
