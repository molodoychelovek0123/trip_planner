import { useState } from 'react';
import { DayPlan } from './DayPlan';
import { Triplist } from './Triplist';
import { Calendar, Bookmark, DollarSign } from 'lucide-react';
import { BudgetTracker } from './BudgetTracker';

export function Sidebar({ readOnly = false }: { readOnly?: boolean }) {
  const [activeTab, setActiveTab] = useState<'plan' | 'saved' | 'budget'>('plan');

  return (
    <div className="flex flex-col h-full bg-white font-sans text-gray-900 border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">TripPlanner</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-white shadow-sm z-10">
        <button
          onClick={() => setActiveTab('plan')}
          className={`flex-1 flex items-center justify-center py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
            activeTab === 'plan'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          <Calendar className="w-4 h-4 mr-1.5" />
          Itinerary
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 flex items-center justify-center py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
            activeTab === 'saved'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          <Bookmark className="w-4 h-4 mr-1.5" />
          Saved
        </button>
        <button
          onClick={() => setActiveTab('budget')}
          className={`flex-1 flex items-center justify-center py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
            activeTab === 'budget'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          <DollarSign className="w-4 h-4 mr-1.5" />
          Budget
        </button>
      </div>

      {/* Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'plan' && <DayPlan readOnly={readOnly} />}
        {activeTab === 'saved' && (
          <div className="p-4">
            <Triplist readOnly={readOnly} />
          </div>
        )}
        {activeTab === 'budget' && (
          <div className="p-4">
            <BudgetTracker readOnly={readOnly} />
          </div>
        )}
      </div>
    </div>
  );
}
