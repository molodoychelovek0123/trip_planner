import { Clock, Zap, WifiOff, MapPin, Compass } from 'lucide-react';
import { UserProfile } from './UserProfile';

export function AuthLanding() {
  const googleAuthUrl = `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/auth/google/url`;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <Compass className="h-8 w-8 text-blue-600" />
          <span className="text-2xl font-bold tracking-tight">TripPlanner</span>
        </div>
        <UserProfile />
      </nav>

      {/* Hero Section */}
      <main>
        <section className="px-6 pt-20 pb-24 max-w-5xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-slate-900 leading-tight">
            Plan your perfect trip, <br className="hidden md:block" />
            <span className="text-blue-600">in minutes not hours.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
            Build, organize, and map your itineraries in a free travel app designed for vacations & road trips. Driven by a powerful scheduling algorithm.
          </p>
          <a
            href={googleAuthUrl}
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Start planning now
          </a>
          <p className="mt-4 text-sm text-slate-500">It's free! Sign up with Google.</p>
        </section>

        {/* Features Section */}
        <section className="bg-slate-50 py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">A smarter way to travel</h2>
              <p className="text-slate-600 max-w-2xl mx-auto text-lg">
                TripPlanner uses advanced routing algorithms to completely automate the tedious parts of vacation planning.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Feature 1 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Smart Auto-Scheduling</h3>
                <p className="text-slate-600 leading-relaxed">
                  Choose your hotel and travel mode. We'll automatically calculate travel times between spots so you know exactly when to leave.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-6">
                  <Clock className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Flexible Time Model</h3>
                <p className="text-slate-600 leading-relaxed">
                  Running late? No problem. Soft constraints mean your entire day shifts smoothly without breaking the rest of your itinerary.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6">
                  <MapPin className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Seamless Onboarding</h3>
                <p className="text-slate-600 leading-relaxed">
                  Just paste a Google Maps link or type the name of a place. We automatically geocode and add it to your plan instantly.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-6">
                  <WifiOff className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Offline-First</h3>
                <p className="text-slate-600 leading-relaxed">
                  No roaming data? Your daily schedule, addresses, and route maps are cached locally so you can view them in airplane mode.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-24 px-6 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to hit the road?</h2>
          <p className="text-xl text-slate-600 mb-10">
            Join thousands of travelers planning their next adventure.
          </p>
          <a
            href={googleAuthUrl}
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-full transition-colors shadow-lg"
          >
            Create your first trip
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Compass className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold">TripPlanner</span>
          </div>
          <div className="text-slate-500 text-sm">
            © {new Date().getFullYear()} TripPlanner. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
