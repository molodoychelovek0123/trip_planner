import type { Place, DayData } from '../types';

export function TriplistItem({
  place,
  days,
  readOnly,
  removeFromTriplist,
  addToDayPlan
}: {
  place: Place;
  days: DayData[];
  readOnly?: boolean;
  removeFromTriplist: (id: string) => void;
  addToDayPlan: (dayId: string, place: Place) => void;
}) {
  return (
    <li className="py-3 flex flex-col group border-b border-gray-100 last:border-b-0">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-900">{place.name}</p>
          <p className="text-xs text-gray-500">{place.recommendedDuration} min</p>
          {place.description && (
            <p className="text-xs text-gray-600 mt-1 italic">{place.description}</p>
          )}
        </div>
        {!readOnly && (
          <button
            onClick={() => removeFromTriplist(place.id)}
            className="text-red-400 hover:text-red-700 text-xs opacity-0 group-hover:opacity-100 transition-opacity ml-2"
          >
            Remove
          </button>
        )}
      </div>

      <div className="mt-3 relative bg-gray-50 p-2 rounded-md border border-gray-100">
        {!readOnly && (
          <div className="flex flex-col gap-2 w-full mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Add to Plan:</span>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
              {days.map((day, idx) => (
                <button
                  key={day.id}
                  onClick={() => addToDayPlan(day.id, place)}
                  className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md shadow-sm border border-blue-200 whitespace-nowrap transition-colors"
                >
                  + Day {idx + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
