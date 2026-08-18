import { Plane, Paperclip, Trash2 } from 'lucide-react';
import { type DayPlanPlace, useTripStore } from '../store';
import { formatCurrency } from '../utils/currency';

export function FlightCard({ 
  flight, 
  onEdit, 
  onRemove,
  readOnly = false
}: { 
  flight: DayPlanPlace; 
  onEdit: () => void;
  onRemove: () => void;
  readOnly?: boolean;
}) {
  const { userCurrency } = useTripStore();
  const fd = flight.flightDetails;
  
  if (!fd) return null;

  // Calculate duration
  const getMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  
  let depMins = getMins(fd.departureTime || '12:00');
  let arrMins = getMins(fd.arrivalTime || '14:00');
  if (arrMins < depMins) arrMins += 24 * 60;
  const flightDurationMins = arrMins - depMins;
  
  const hours = Math.floor(flightDurationMins / 60);
  const mins = flightDurationMins % 60;
  const durationStr = `${hours}h ${mins}min`;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-4 group transition-shadow hover:shadow-md">
      <div className="flex flex-col md:flex-row">
        {/* Left Side: Flight Info */}
        <div className="flex-1 p-5 relative">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center">
              {fd.departureAirport} <Plane className="w-4 h-4 mx-2 text-gray-400 transform rotate-45" /> {fd.arrivalAirport}
            </h3>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              On Schedule
            </span>
          </div>
          
          <div className="text-gray-600 text-sm font-medium mb-1">
            Flight {fd.flightNumber}
          </div>
          <div className="text-gray-400 text-xs mb-6">
            Duration: {durationStr} &bull; Check-in {fd.bufferHours}h before
          </div>

          <div className="relative pl-4 border-l-2 border-dotted border-gray-300 space-y-6">
            {/* Departure */}
            <div className="relative">
              <div className="absolute -left-[21px] top-1.5 w-2 h-2 bg-white border-2 border-gray-400 rounded-full"></div>
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm font-bold text-gray-900">{fd.departureAirport}</div>
                  <div className="text-2xl font-black text-gray-900 tracking-tighter mt-1">
                    {fd.departureTime || '12:00'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Terminal</div>
                  <div className="text-lg font-bold text-gray-700">-</div>
                </div>
              </div>
            </div>

            {/* Arrival */}
            <div className="relative">
              <div className="absolute -left-[21px] top-1.5 w-2 h-2 bg-white border-2 border-gray-400 rounded-full"></div>
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm font-bold text-gray-900">{fd.arrivalAirport}</div>
                  <div className="text-2xl font-black text-gray-900 tracking-tighter mt-1">
                    {fd.arrivalTime || '14:00'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Terminal</div>
                  <div className="text-lg font-bold text-gray-700">-</div>
                </div>
              </div>
            </div>
          </div>

          {!readOnly && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
              <div className="flex items-center text-xs font-semibold text-emerald-600">
                <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
                Flight tracked
              </div>
              <div className="flex gap-2">
                <button onClick={onEdit} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                  Edit
                </button>
                <button onClick={onRemove} className="bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Extras */}
        <div className="bg-gray-50 p-5 w-full md:w-64 border-t md:border-t-0 md:border-l border-gray-200 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cost</div>
              <Paperclip className="w-4 h-4 text-gray-400" />
            </div>
            
            {flight.cost ? (
              <div className="bg-gray-200/50 inline-block px-3 py-1 rounded-full text-sm font-bold text-gray-700">
                {formatCurrency(flight.cost, flight.currency || userCurrency)}
              </div>
            ) : (
              <div className="text-xs text-gray-400 font-medium italic">No cost added</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
