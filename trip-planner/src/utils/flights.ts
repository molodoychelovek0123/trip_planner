const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
export interface FlightInfo {
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
}

export async function fetchFlightInfo(flightNumber: string): Promise<FlightInfo | null> {
  const normalized = flightNumber.replace(/\s+/g, '').toUpperCase();
  if (normalized.length < 3) return null;
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/flights/parse?flight_number=${encodeURIComponent(normalized)}`);
    if (!response.ok) {
      console.error('Failed to parse flight', await response.text());
      return null;
    }
    const data: FlightInfo = await response.json();
    return data;
  } catch (err) {
    console.error('Error fetching flight info:', err);
    return null;
  }
}
