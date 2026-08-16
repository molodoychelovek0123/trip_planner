import { Triplist } from './components/Triplist'
import { DayPlan } from './components/DayPlan'

function App() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">TripPlanner</h1>
          <p className="text-gray-600">Stage 1 - Pure Frontend PoC</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          <div className="md:col-span-1 sticky top-8">
            <Triplist />
          </div>
          <div className="md:col-span-2">
            <DayPlan />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
