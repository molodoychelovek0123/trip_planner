import { useState, useEffect } from 'react';
import { Plane, X } from 'lucide-react';
import { useTripStore, type DayPlanPlace } from '../store';
import { getAirportLocation } from '../utils/airports';
import { useDebounce } from '../utils/useDebounce';
import { fetchFlightInfo } from '../utils/flights';

export function AddFlightModal({ 
  dayId, 
  existingFlight,
  onClose 
}: { 
  dayId: string; 
  existingFlight?: DayPlanPlace;
  onClose: () => void; 
}) {
  const { addFlight, updateFlightDetails } = useTripStore();
  const [flightNumber, setFlightNumber] = useState('');
  const [departureAirport, setDepartureAirport] = useState('');
  const [arrivalAirport, setArrivalAirport] = useState('');
  const [departureTime, setDepartureTime] = useState('12:00');
  const [arrivalTime, setArrivalTime] = useState('14:00');
  const [bufferHours, setBufferHours] = useState('2');
  
  const debouncedFlightNumber = useDebounce(flightNumber, 500);
  const [lastParsedFlight, setLastParsedFlight] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  useEffect(() => {
    if (existingFlight && existingFlight.flightDetails) {
      const fd = existingFlight.flightDetails;
      setFlightNumber(fd.flightNumber || '');
      setLastParsedFlight(fd.flightNumber || ''); // Prevent auto-parsing the existing flight on open
      setDepartureAirport(fd.departureAirport || '');
      setArrivalAirport(fd.arrivalAirport || '');
      setDepartureTime(fd.departureTime || '12:00');
      setArrivalTime(fd.arrivalTime || '14:00');
      setBufferHours((fd.bufferHours || 2).toString());
    }
  }, [existingFlight]);

  useEffect(() => {
    const fetchInfo = async () => {
      const trimmed = debouncedFlightNumber.trim();
      if (trimmed.length >= 3 && trimmed !== lastParsedFlight) {
        setIsParsing(true);
        const info = await fetchFlightInfo(trimmed);
        if (info) {
          setDepartureAirport(info.departureAirport);
          setArrivalAirport(info.arrivalAirport);
          setDepartureTime(info.departureTime);
          setArrivalTime(info.arrivalTime);
          setLastParsedFlight(trimmed);
        }
        setIsParsing(false);
      }
    };
    fetchInfo();
  }, [debouncedFlightNumber, lastParsedFlight]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flightNumber || !departureAirport || !arrivalAirport) return;
    
    const dAirport = departureAirport.toUpperCase();
    const aAirport = arrivalAirport.toUpperCase();
    
    // Calculate fixed duration
    const getMins = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    
    let depMins = getMins(departureTime);
    let arrMins = getMins(arrivalTime);
    if (arrMins < depMins) arrMins += 24 * 60; // Overnight flight
    
    const bufferMins = Number(bufferHours) * 60;
    const exitMins = 60; // 1 hour to exit airport
    const totalDuration = bufferMins + (arrMins - depMins) + exitMins;
    const name = `Flight ${flightNumber}`;

    const flightDetails = {
      flightNumber,
      departureAirport: dAirport,
      arrivalAirport: aAirport,
      departureTime,
      arrivalTime,
      bufferHours: Number(bufferHours)
    };
    
    const finalizeFlight = (lat: number, lng: number) => {
      if (existingFlight) {
        updateFlightDetails(dayId, existingFlight.uniqueId, flightDetails, name, lat, lng, totalDuration);
      } else {
        const newFlight: any = {
          id: `flight-${Date.now()}`,
          name,
          lat,
          lng,
          recommendedDuration: totalDuration,
          userDuration: totalDuration,
          city: 'Transit',
          type: 'FLIGHT',
          flightDetails
        };
        addFlight(dayId, newFlight);
      }
      onClose();
    };

    const airportInfo = getAirportLocation(dAirport);
    if (airportInfo && airportInfo.lat !== 0) {
      finalizeFlight(airportInfo.lat, airportInfo.lng);
    } else if (window.google && window.google.maps) {
      // Use Geocoder
      const geocoder = new window.google.maps.Geocoder();
      try {
        const results = await geocoder.geocode({ address: `${dAirport} Airport` });
        if (results.results && results.results.length > 0) {
          const loc = results.results[0].geometry.location;
          finalizeFlight(loc.lat(), loc.lng());
        } else {
          finalizeFlight(0, 0);
        }
      } catch (err) {
        console.error("Geocoding failed", err);
        finalizeFlight(0, 0);
      }
    } else {
      finalizeFlight(0, 0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
            <Plane className="w-5 h-5 text-blue-600" />
            {existingFlight ? 'Edit Flight' : 'Add Flight'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
              Flight Number
              {isParsing && <span className="text-xs font-normal text-blue-500 animate-pulse">Searching...</span>}
            </label>
            <input required type="text" placeholder="e.g. AF 1234" value={flightNumber} onChange={e => setFlightNumber(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white p-2 border" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Departure Airport</label>
              <input required type="text" placeholder="JFK" value={departureAirport} onChange={e => setDepartureAirport(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white p-2 border uppercase" maxLength={3} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Arrival Airport</label>
              <input required type="text" placeholder="CDG" value={arrivalAirport} onChange={e => setArrivalAirport(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white p-2 border uppercase" maxLength={3} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Departure Time</label>
              <input required type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Arrival Time</label>
              <input required type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white p-2 border" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Arrive early (Buffer Hours)</label>
            <select value={bufferHours} onChange={e => setBufferHours(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white p-2 border">
              <option value="1">1 Hour</option>
              <option value="2">2 Hours</option>
              <option value="3">3 Hours</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Time needed at the airport before departure.</p>
          </div>

          <div className="pt-4">
            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm">
              {existingFlight ? 'Save Changes' : 'Add to Itinerary'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
