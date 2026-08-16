import { useState, useRef, useEffect } from 'react';
import { useTripStore } from '../store';
import { v4 as uuidv4 } from 'uuid';

export function MapContextMenu({
  isOpen,
  position,
  latLng,
  onClose
}: {
  isOpen: boolean;
  position: { x: number, y: number };
  latLng: { lat: number, lng: number } | null;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { addToTriplist } = useTripStore();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setName('');
      setDescription('');
    }
  }, [isOpen]);

  if (!isOpen || !latLng) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addToTriplist({
      id: uuidv4(),
      name: name.trim(),
      description: description.trim() || undefined,
      lat: latLng.lat,
      lng: latLng.lng,
      recommendedDuration: 30
    });

    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-72"
        style={{ top: position.y, left: position.x }}
      >
        <h3 className="text-sm font-bold text-gray-800 mb-3">Add Custom Place</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="E.g., Secret Viewpoint"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 resize-none"
              placeholder="Notes..."
              rows={2}
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Save to Triplist
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
