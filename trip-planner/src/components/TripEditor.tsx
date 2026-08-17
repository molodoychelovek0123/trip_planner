import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MapView } from './MapView';
import { useAuthStore, useTripStore } from '../store';
import { Share2 } from 'lucide-react';

export function TripEditor() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore(state => state.token);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initFromServer = useTripStore(state => state.initFromServer);

  useEffect(() => {
    if (!token) {
        navigate('/');
        return;
    }

    if (tripId) {
        // Set active trip ID immediately so persist can use it
        useAuthStore.setState({ activeTripId: tripId });

        fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/trips/${tripId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(res => {
            if (!res.ok) throw new Error(res.statusText);
            return res.json();
        })
        .then(data => {
            if (data.state) {
                initFromServer(data.state);
            }
        })
        .catch(err => {
            console.error(err);
            setError("Failed to load trip or unauthorized.");
        })
        .finally(() => {
            setLoading(false);
        });
    }
  }, [tripId, token, navigate, initFromServer]);

  if (loading) {
      return <div className="flex items-center justify-center h-screen w-screen bg-gray-50"><p>Loading trip...</p></div>;
  }

  if (error) {
       return <div className="flex items-center justify-center h-screen w-screen bg-gray-50 text-red-500"><p>{error}</p></div>;
  }

  return (
    <div className="h-screen w-screen flex bg-gray-50 overflow-hidden relative">
      {/* Header overlay */}
      <div className="absolute top-0 left-0 w-full h-12 bg-white/90 backdrop-blur border-b z-20 flex justify-between items-center px-4">
          <button onClick={() => navigate('/dashboard')} className="text-sm font-medium text-gray-600 hover:text-gray-900">
              &larr; Dashboard
          </button>
          <div className="flex items-center space-x-4">
              <button onClick={() => alert("Share functionality to be implemented in a modal")} className="text-gray-600 hover:text-blue-600 p-1 flex items-center text-sm">
                  <Share2 className="w-4 h-4 mr-1" /> Share
              </button>
          </div>
      </div>

      <div className="pt-12 flex w-full h-full">
        {/* Sidebar - Fixed width on left */}
        <div className="w-[450px] flex-shrink-0 bg-white shadow-2xl z-10 flex flex-col h-full border-r border-gray-200">
          <Sidebar />
        </div>

        {/* Map Area - Fills remaining space */}
        <div className="flex-1 relative h-full bg-gray-200">
          <MapView />
        </div>
      </div>
    </div>
  );
}
