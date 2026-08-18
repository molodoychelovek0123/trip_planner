import { Plane, Ticket, Hotel, Wallet } from 'lucide-react';
import { useTripStore } from '../store';
import { useMemo } from 'react';
import { convertCurrency, formatCurrency } from '../utils/currency';

export function BudgetTracker({ readOnly = false }: { readOnly?: boolean }) {
  const { days, userCurrency, setUserCurrency } = useTripStore();

  const { total, categories, expenses } = useMemo(() => {
    let totalAmt = 0;
    const catTotals = {
      Flights: 0,
      Hotels: 0,
      Activities: 0
    };
    
    const expList: { title: string, amount: number, originalAmount: number, originalCurrency: string, category: string, dayIdx: number }[] = [];

    days.forEach((day, idx) => {
      const processPlace = (place: { type?: string, types?: string[], name: string, cost?: number, currency?: string }) => {
        if (place.cost && place.currency) {
          const convertedAmt = convertCurrency(place.cost, place.currency, userCurrency);
          totalAmt += convertedAmt;
          
          let category = 'Activities';
          if (place.type === 'FLIGHT') {
             category = 'Flights';
             catTotals.Flights += convertedAmt;
          } else if (place.name.toLowerCase().includes('hotel') || place.name.toLowerCase().includes('hostel')) {
             category = 'Hotels';
             catTotals.Hotels += convertedAmt;
          } else {
             catTotals.Activities += convertedAmt;
          }

          expList.push({
            title: place.name,
            amount: convertedAmt,
            originalAmount: place.cost,
            originalCurrency: place.currency,
            category,
            dayIdx: idx + 1
          });
        }
      };

      day.plan.forEach(processPlace);
      if (day.flights) {
        day.flights.forEach(processPlace);
      }
    });
    
    return { total: totalAmt, categories: catTotals, expenses: expList };
  }, [days, userCurrency]);

  if (total === 0 && readOnly) return null;

  return (
    <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-gray-800">Trip Budget</h2>
        </div>
        
        <select
          value={userCurrency}
          onChange={(e) => setUserCurrency(e.target.value)}
          className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
        >
          <option value="USD">USD ($)</option>
          <option value="EUR">EUR (€)</option>
          <option value="GBP">GBP (£)</option>
          <option value="JPY">JPY (¥)</option>
          <option value="RUB">RUB (₽)</option>
          <option value="AUD">AUD (A$)</option>
          <option value="CAD">CAD (C$)</option>
        </select>
      </div>
      
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Estimated</p>
        <div className="text-3xl font-extrabold text-gray-900 tracking-tight">
          {formatCurrency(total, userCurrency)}
        </div>
      </div>

      {total > 0 ? (
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center text-gray-600 gap-1.5"><Plane className="w-4 h-4 text-blue-500"/> Flights</span>
            <span className="font-semibold">{formatCurrency(categories.Flights, userCurrency)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center text-gray-600 gap-1.5"><Hotel className="w-4 h-4 text-purple-500"/> Hotels</span>
            <span className="font-semibold">{formatCurrency(categories.Hotels, userCurrency)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center text-gray-600 gap-1.5"><Ticket className="w-4 h-4 text-orange-500"/> Activities</span>
            <span className="font-semibold">{formatCurrency(categories.Activities, userCurrency)}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-6 italic">No expenses recorded yet.</p>
      )}

      {expenses.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Detailed Breakdown</h3>
          <div className="space-y-3 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {expenses.map((e, idx) => (
              <div key={idx} className="flex justify-between items-start text-sm p-2 bg-gray-50 rounded-lg">
                <div className="flex flex-col overflow-hidden mr-2">
                  <span className="font-medium text-gray-800 truncate" title={e.title}>{e.title}</span>
                  <span className="text-[10px] text-gray-400 font-semibold mt-0.5 uppercase tracking-wider">Day {e.dayIdx} &bull; {e.category}</span>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="font-bold text-gray-700">{formatCurrency(e.amount, userCurrency)}</span>
                  {e.originalCurrency !== userCurrency && (
                    <span className="text-[10px] text-gray-400">{e.originalAmount.toLocaleString()} {e.originalCurrency}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
