export const AIRPORTS: Record<string, { lat: number, lng: number, city: string }> = {
  // USA
  'JFK': { lat: 40.6413, lng: -73.7781, city: 'New York' },
  'LAX': { lat: 33.9416, lng: -118.4085, city: 'Los Angeles' },
  'SFO': { lat: 37.6213, lng: -122.3790, city: 'San Francisco' },
  'ORD': { lat: 41.9742, lng: -87.9073, city: 'Chicago' },
  
  // Europe
  'CDG': { lat: 49.0097, lng: 2.5479, city: 'Paris' },
  'LHR': { lat: 51.4700, lng: -0.4543, city: 'London' },
  'FRA': { lat: 50.0379, lng: 8.5622, city: 'Frankfurt' },
  'AMS': { lat: 52.3105, lng: 4.7683, city: 'Amsterdam' },
  
  // Asia
  'NRT': { lat: 35.7720, lng: 140.3929, city: 'Tokyo' },
  'HND': { lat: 35.5494, lng: 139.7798, city: 'Tokyo' },
  'DXB': { lat: 25.2532, lng: 55.3657, city: 'Dubai' },
  'SIN': { lat: 1.3644, lng: 103.9915, city: 'Singapore' },
  
  // Default generic unknown
  'UNK': { lat: 0, lng: 0, city: 'Unknown' }
};

export function getAirportLocation(code: string) {
  const upperCode = code.toUpperCase();
  return AIRPORTS[upperCode] || null;
}
