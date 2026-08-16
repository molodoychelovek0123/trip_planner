import { Sidebar } from './components/Sidebar'
import { MapView } from './components/MapView'

function App() {
  return (
    <div className="h-screen w-screen flex bg-gray-50 overflow-hidden">
      {/* Sidebar - Fixed width on left */}
      <div className="w-[450px] flex-shrink-0 bg-white shadow-2xl z-10 flex flex-col h-full border-r border-gray-200">
        <Sidebar />
      </div>

      {/* Map Area - Fills remaining space */}
      <div className="flex-1 relative h-full bg-gray-200">
        <MapView />
      </div>
    </div>
  )
}

export default App
