import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export function SavedPlacesMap({ places, hoveredPlaceId }: { places: any[], hoveredPlaceId: string | null }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;

    setOptions({
      key: GOOGLE_MAPS_API_KEY,
      v: 'weekly',
    });

    importLibrary('maps').then(({ Map }) => {
      const newMap = new Map(mapRef.current!, {
        center: { lat: 20, lng: 0 },
        zoom: 2,
        mapId: 'DEMO_MAP_ID',
        disableDefaultUI: true,
        zoomControl: true,
      });
      setMap(newMap);
    });
  }, []);

  useEffect(() => {
    if (!map) return;

    importLibrary('marker').then(({ AdvancedMarkerElement, PinElement }) => {
      // Clear existing
      markersRef.current.forEach(m => m.map = null);
      markersRef.current = [];

      places.forEach(place => {
        const isHovered = place.id === hoveredPlaceId;
        const pin = new PinElement({
          background: isHovered ? '#ea4335' : '#888',
          borderColor: isHovered ? '#c5221f' : '#666',
          glyphColor: 'white',
          scale: isHovered ? 1.2 : 1.0,
        });

        const marker = new AdvancedMarkerElement({
          map,
          position: { lat: place.lat, lng: place.lng },
          content: pin.element,
          title: place.name,
        });

        markersRef.current.push(marker);
      });
    });
  }, [map, places, hoveredPlaceId]);

  useEffect(() => {
    if (map && hoveredPlaceId) {
      const place = places.find(p => p.id === hoveredPlaceId);
      if (place) {
        map.panTo({ lat: place.lat, lng: place.lng });
        if (map.getZoom() < 12) {
          map.setZoom(12);
        }
      }
    }
  }, [map, hoveredPlaceId, places]);

  return <div ref={mapRef} className="w-full h-full" />;
}