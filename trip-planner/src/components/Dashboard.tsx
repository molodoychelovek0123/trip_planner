import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store';
import { Plus, Copy, Trash2, Globe, Heart } from 'lucide-react';
import { UserProfile } from './UserProfile';

interface TripMeta {
  id: string;
  title: string;
  created_at: string;
  is_public: boolean;
}

export function Dashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setToken = useAuthStore((state) => state.setToken);
  const token = useAuthStore((state) => state.token);
  const [trips, setTrips] = useState<TripMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
      navigate('/dashboard', { replace: true });
    }
  }, [searchParams, setToken, navigate]);

  useEffect(() => {
    if (!token) {
        setLoading(false);
        return;
    }

    fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/trips`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
            setTrips(data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const handleCreate = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: 'New Trip' })
      });
      const data = await res.json();
      if (data.trip_id) {
        navigate(`/trip/${data.trip_id}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDuplicate = async (tripId: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/trips/${tripId}/duplicate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.trip_id) {
        window.location.reload(); // Simple reload to refresh list
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (tripId: string) => {
    if (!confirm("Are you sure you want to delete this trip?")) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/trips/${tripId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setTrips(trips.filter(t => t.id !== tripId));
    } catch (e) {
      console.error(e);
    }
  };

  if (!token) {
      return (
          <div className="p-8 text-center">
              <p>Please log in.</p>
              <button onClick={() => navigate('/')} className="text-blue-500 underline mt-4">Go to Login</button>
          </div>
      )
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">My Trips</h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/favorites')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                <Heart className="mr-2 h-4 w-4 text-pink-500" />
                Saved Places
              </button>
              <button
                onClick={handleCreate}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Trip
              </button>
              <UserProfile />
            </div>
        </div>

        {loading ? (
            <p>Loading...</p>
        ) : trips.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">No trips yet</h3>
                <p className="mt-1 text-gray-500">Get started by creating a new trip.</p>
                <div className="mt-6">
                    <button onClick={handleCreate} className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                        Create Trip
                    </button>
                </div>
            </div>
        ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <div key={trip.id} className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 flex flex-col">
                  <div className="px-4 py-5 sm:p-6 flex-1 cursor-pointer" onClick={() => navigate(`/trip/${trip.id}`)}>
                    <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                        {trip.title}
                        {trip.is_public && <div title="Public"><Globe className="ml-2 h-4 w-4 text-blue-500" /></div>}
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">
                        Created: {new Date(trip.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="bg-gray-50 px-4 py-4 sm:px-6 flex justify-end space-x-2 border-t border-gray-200">
                    <button onClick={() => handleDuplicate(trip.id)} className="text-gray-400 hover:text-indigo-600 p-1" title="Duplicate">
                        <Copy className="h-5 w-5" />
                    </button>
                    <button onClick={() => handleDelete(trip.id)} className="text-gray-400 hover:text-red-600 p-1" title="Delete">
                        <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
        )}
      </div>
    </div>
  );
}
