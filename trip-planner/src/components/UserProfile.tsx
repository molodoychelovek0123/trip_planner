import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../store';
import { User, LogOut, LayoutDashboard } from 'lucide-react';

export function UserProfile() {
  const token = useAuthStore(state => state.token);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();
  const location = useLocation();

  const googleAuthUrl = `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/auth/google/url`;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!token) {
    return (
      <div className="flex space-x-4">
        <a
          href={googleAuthUrl}
          className="text-slate-600 hover:text-slate-900 font-medium px-4 py-2"
        >
          Log in
        </a>
        <a
          href={googleAuthUrl}
          className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-5 py-2 rounded-full transition-colors"
        >
          Sign up
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-4">
      {location.pathname !== '/dashboard' && (
        <Link
          to="/dashboard"
          className="flex items-center text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <LayoutDashboard className="w-4 h-4 mr-1" />
          Dashboard
        </Link>
      )}
      <div className="flex items-center space-x-2 text-slate-700 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
        <User className="w-4 h-4" />
        <span className="text-sm font-medium pr-2 border-r border-slate-300">Profile</span>
        <button
          onClick={handleLogout}
          className="text-sm font-medium text-slate-500 hover:text-red-600 flex items-center pl-1"
          title="Log out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
