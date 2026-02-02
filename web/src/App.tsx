import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Overview from './pages/Overview';
import Sessions from './pages/Sessions';
import SessionDetail from './pages/SessionDetail';
import Alerts from './pages/Alerts';
import { useWebSocket } from './hooks/useWebSocket';

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}

export default function App() {
  const { connected, events, alerts } = useWebSocket();
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useEffect(() => {
    if (alerts.length > 0) {
      setUnreadAlerts(prev => prev + 1);
    }
  }, [alerts]);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-xl font-bold text-white">Observatory</span>
              </Link>

              <nav className="flex gap-2">
                <NavLink to="/">Overview</NavLink>
                <NavLink to="/sessions">Sessions</NavLink>
                <NavLink to="/alerts">
                  Alerts
                  {unreadAlerts > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                      {unreadAlerts}
                    </span>
                  )}
                </NavLink>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                connected ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
                {connected ? 'Connected' : 'Disconnected'}
              </div>

              {events.length > 0 && (
                <div className="text-sm text-slate-400">
                  {events.length} events received
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/sessions/:sessionKey" element={<SessionDetail />} />
          <Route path="/alerts" element={<Alerts onView={() => setUnreadAlerts(0)} />} />
        </Routes>
      </main>
    </div>
  );
}
