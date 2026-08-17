import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MapView } from './MapView';
import { useAuthStore, useTripStore } from '../store';
import { Share2, X, Copy, Check } from 'lucide-react';
import { UserProfile } from './UserProfile';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export function TripEditor() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore(state => state.token);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Share modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const initFromServer = useTripStore(state => state.initFromServer);

  useEffect(() => {
    if (!token) {
        navigate('/');
        return;
    }

    if (tripId) {
        // Set active trip ID immediately so persist can use it
        useAuthStore.setState({ activeTripId: tripId });

        fetch(`${API_BASE}/api/trips/${tripId}`, {
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
            // Store share state for the modal
            if (typeof data.is_public === 'boolean') {
                setIsPublic(data.is_public);
            }
            if (data.share_token) {
                setShareToken(data.share_token);
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

  const shareLink = shareToken ? `${window.location.origin}/share/${shareToken}` : null;

  const togglePublic = async () => {
    if (!tripId || !token) return;
    setShareLoading(true);
    setShareError(null);
    try {
      const res = await fetch(`${API_BASE}/api/trips/${tripId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_public: !isPublic })
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setIsPublic(data.is_public);
      setShareToken(data.share_token);
    } catch (err) {
      console.error(err);
      setShareError("Failed to update sharing settings.");
    } finally {
      setShareLoading(false);
    }
  };

  const copyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      setShareError("Failed to copy link.");
    }
  };

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
              <button onClick={() => setIsShareModalOpen(true)} className="text-gray-600 hover:text-blue-600 p-1 flex items-center text-sm">
                  <Share2 className="w-4 h-4 mr-1" /> Share
              </button>
              <UserProfile />
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

      {/* Share Modal */}
      {isShareModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setIsShareModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[440px] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Share Trip</h2>
              <button onClick={() => setIsShareModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Make public</p>
                <p className="text-xs text-gray-500">Anyone with the link can view this trip</p>
              </div>
              <button
                onClick={togglePublic}
                disabled={shareLoading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isPublic ? 'bg-blue-600' : 'bg-gray-300'} ${shareLoading ? 'opacity-50 cursor-wait' : ''}`}
                role="switch"
                aria-checked={isPublic}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {shareError && (
              <p className="text-sm text-red-600 mb-3">{shareError}</p>
            )}

            {isPublic && shareLink && (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="flex-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={copyLink}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Copy link'}</span>
                </button>
              </div>
            )}

            {isPublic && !shareLink && (
              <p className="text-sm text-gray-500">Turn on public sharing to generate a link.</p>
            )}

            <div className="mt-6 flex justify-end">
              <button onClick={() => setIsShareModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
