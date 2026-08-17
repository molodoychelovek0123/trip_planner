import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthLanding } from './components/AuthLanding'
import { Dashboard } from './components/Dashboard'
import { TripEditor } from './components/TripEditor'
import { SharedTrip } from './components/SharedTrip'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthLanding />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/trip/:tripId" element={<TripEditor />} />
        <Route path="/share/:shareToken" element={<SharedTrip />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
