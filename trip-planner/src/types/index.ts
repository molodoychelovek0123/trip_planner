export interface AuthState {
  token: string | null;
  activeTripId: string | null;
  setToken: (token: string | null) => void;
  setActiveTripId: (tripId: string | null) => void;
  logout: () => void;
}

export interface Place {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  recommendedDuration: number;
  city?: string;
}

export interface TransitBadge {
  vehicleType: string;
  shortName: string;
  color: string;
  textColor: string;
}

export interface RouteStep {
  travelMode: string;
  encodedPolyline: string;
  color?: string;
}

export interface RouteAlternative {
  durationMinutes: number;
  summary: string;
  steps: RouteStep[];
  transitBadges?: TransitBadge[];
}

export interface TravelSegment {
  durationMinutes: number;
  mode: 'DRIVING' | 'WALKING' | 'TRANSIT' | 'MANUAL';
  routeAlternatives?: RouteAlternative[];
  selectedRouteIndex?: number;
}

export interface FlightDetails {
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime?: string;
  arrivalTime?: string;
  bufferHours?: number;
}

export interface DayPlanPlace extends Place {
  type?: 'PLACE' | 'FLIGHT';
  userDuration: number;
  travelFromPrevious?: TravelSegment;
  uniqueId: string;
  lockedArrivalTime?: string;
  cost?: number;
  currency?: string;
  flightDetails?: FlightDetails;
}

export interface DayData {
  id: string;
  startTime: string;
  plan: DayPlanPlace[];
  flights: DayPlanPlace[];
  startHotelId?: string;
  endHotelId?: string;
  endHotelTravel?: TravelSegment;
}

export interface TripState {
  triplist: Place[];
  days: DayData[];
  activeDayId: string | null;
  userCurrency: string;
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncError: string | null;

  // App Actions
  setDays: (days: DayData[]) => void;
  setUserCurrency: (currency: string) => void;
  setActiveDay: (dayId: string) => void;
  addDay: () => void;
  removeDay: (dayId: string) => void;
  setDayStartTime: (dayId: string, time: string) => void;
  setStartHotel: (dayId: string, hotelId: string | undefined) => void;
  setEndHotel: (dayId: string, hotelId: string | undefined) => void;

  // Triplist Actions
  addToTriplist: (place: Place) => void;
  removeFromTriplist: (id: string) => void;

  // DayPlan Actions
  addToDayPlan: (dayId: string, place: Place) => void;
  removeFromDayPlan: (dayId: string, uniqueId: string) => void;
  reorderDayPlan: (dayId: string, newPlan: DayPlanPlace[]) => void;
  updatePlaceDuration: (dayId: string, uniqueId: string, duration: number) => void;
  updateTravelSegment: (dayId: string, uniqueId: string, segment: TravelSegment | undefined) => void;
  updateEndHotelTravel: (dayId: string, segment: TravelSegment | undefined) => void;
  updateLockedArrivalTime: (dayId: string, uniqueId: string, time: string | undefined) => void;
  updatePlaceCost: (dayId: string, uniqueId: string, cost: number | undefined, currency: string | undefined) => void;
  
  // Flights
  addFlight: (dayId: string, flight: DayPlanPlace) => void;
  removeFlight: (dayId: string, uniqueId: string) => void;
  updateFlightDetails: (dayId: string, uniqueId: string, flightDetails: FlightDetails, name: string, lat: number, lng: number, userDuration: number) => void;
  updateFlightCost: (dayId: string, uniqueId: string, cost: number | undefined, currency: string | undefined) => void;

  initFromServer: (serverState: Partial<TripState>) => void;
}
