import { useTripStore } from '../store';
import { calculateDistance } from '../utils/haversine';
import { PlusCircle } from 'lucide-react';

export function SmartSuggestions() {
  const { triplist, dayPlan, addToDayPlan } = useTripStore();

  if (dayPlan.length === 0 || triplist.length === 0) {
    return null; // Don't show suggestions if no day plan started or triplist is empty
  }

  const lastPoint = dayPlan[dayPlan.length - 1];

  // Filter out places already in the day plan
  const availablePlaces = triplist.filter(
    (place) => !dayPlan.some((dp) => dp.id === place.id)
  );

  if (availablePlaces.length === 0) {
    return null;
  }

  // Calculate distance from the last point and sort
  const suggestions = availablePlaces
    .map((place) => ({
      ...place,
      distance: calculateDistance(lastPoint.lat, lastPoint.lng, place.lat, place.lng),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3); // Top 3 closest points

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  return (
    <div className="bg-blue-50 rounded-lg p-4 mt-6 border border-blue-100">
      <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
        💡 Suggested next stops (closest to {lastPoint.name})
      </h3>
      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className="flex items-center justify-between bg-white p-2 rounded border border-blue-50 shadow-sm hover:border-blue-200 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-gray-800">{suggestion.name}</p>
              <p className="text-xs text-gray-500">{formatDistance(suggestion.distance)} away</p>
            </div>
            <button
              onClick={() => addToDayPlan(suggestion)}
              className="text-blue-600 hover:text-blue-800 p-1"
              title="Add to Day Plan"
            >
              <PlusCircle className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
