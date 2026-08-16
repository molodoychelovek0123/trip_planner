import { useState } from 'react';
import { DayPlan } from './DayPlan';
import { Triplist } from './Triplist';
import { Calendar, Bookmark } from 'lucide-react';

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<'plan' | 'saved'>('plan');

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold text-gray-900">TripPlanner</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-gray-50">
        <button
          onClick={() => setActiveTab('plan')}
          className={`flex-1 flex items-center justify-center py-3 text-sm font-medium transition-colors ${
            activeTab === 'plan'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Calendar className="w-4 h-4 mr-2" />
          Day Plan
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 flex items-center justify-center py-3 text-sm font-medium transition-colors ${
            activeTab === 'saved'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Bookmark className="w-4 h-4 mr-2" />
          Saved Places
        </button>
      </div>

      {/* Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'plan' ? <DayPlan /> : <Triplist />}
      </div>
    </div>
  );
}
