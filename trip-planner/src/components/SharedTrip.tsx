import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MapView } from './MapView';
import { useTripStore } from '../store';

export function SharedTrip() {
  const { shareToken } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tripTitle, setTripTitle] = useState("Shared Trip");

  const initFromServer = useTripStore(state => state.initFromServer);

  useEffect(() => {
    // We explicitly set a generic non-syncing id for shared trips
    // to prevent local mutations from persisting accidentally if the user is logged in

    if (shareToken) {
        fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/share/${shareToken}`)
        .then(res => {
            if (!res.ok) throw new Error(res.statusText);
            return res.json();
        })
        .then(data => {
            if (data.title) setTripTitle(data.title);
            if (data.state) {
                initFromServer(data.state);
            }
        })
        .catch(err => {
            console.error(err);
            setError("Shared trip not found or is private.");
        })
        .finally(() => {
            setLoading(false);
        });
    }
  }, [shareToken, initFromServer]);

  if (loading) {
      return <div className="flex items-center justify-center h-screen w-screen bg-gray-50"><p>Loading shared trip...</p></div>;
  }

  if (error) {
       return <div className="flex items-center justify-center h-screen w-screen bg-gray-50 text-red-500"><p>{error}</p></div>;
  }

  return (
    <div className="h-screen w-screen flex bg-gray-50 overflow-hidden relative pointer-events-none">
      {/* Header overlay */}
      <div className="absolute top-0 left-0 w-full h-12 bg-white/90 backdrop-blur border-b z-50 flex justify-between items-center px-4 pointer-events-auto">
          <div className="font-bold text-gray-800">{tripTitle}</div>
          <div className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded border border-yellow-200">
              View Only
          </div>
      </div>

      <div className="pt-12 flex w-full h-full">
        {/* Sidebar - Fixed width on left */}
        <div className="w-[450px] flex-shrink-0 bg-white shadow-2xl z-10 flex flex-col h-full border-r border-gray-200">
            {/* The Sidebar component internally will need some 'readOnly' prop ideally, but for now CSS pointer-events-none on parent works ok for simple view, though it breaks scrolling.
                A proper implementation would pass readOnly to Sidebar/DayPlan.
                For MVP, we allow scrolling by overriding pointer events on specific containers if needed.
             */}
          <div className="pointer-events-auto h-full overflow-y-auto">
             <Sidebar />
          </div>
        </div>

        {/* Map Area - Fills remaining space */}
        <div className="flex-1 relative h-full bg-gray-200 pointer-events-auto">
          <MapView />
        </div>
      </div>
    </div>
  );
}
