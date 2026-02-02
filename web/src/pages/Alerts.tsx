import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAlerts } from '../hooks/useApi';

interface AlertsProps {
  onView: () => void;
}

export default function Alerts({ onView }: AlertsProps) {
  const { data: alertsData, loading, refetch } = useAlerts();
  const alerts = alertsData?.alerts || [];

  useEffect(() => {
    onView();
  }, [onView]);

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-900/50 border-red-700 text-red-200';
      case 'error':
        return 'bg-red-900/30 border-red-800 text-red-300';
      case 'warning':
        return 'bg-yellow-900/30 border-yellow-800 text-yellow-300';
      default:
        return 'bg-blue-900/30 border-blue-800 text-blue-300';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
          <svg className="w-12 h-12 text-green-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-white mb-2">All Clear</h3>
          <p className="text-slate-400">No alerts have been triggered recently.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`rounded-lg border p-4 ${getSeverityStyles(alert.severity)}`}
            >
              <div className="flex items-start gap-3">
                {getSeverityIcon(alert.severity)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded uppercase ${
                      alert.severity === 'critical' ? 'bg-red-800 text-red-200' :
                      alert.severity === 'error' ? 'bg-red-900 text-red-300' :
                      alert.severity === 'warning' ? 'bg-yellow-900 text-yellow-300' :
                      'bg-blue-900 text-blue-300'
                    }`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(alert.triggeredAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm">{alert.message}</p>
                  {alert.sessionKey && (
                    <Link
                      to={`/sessions/${encodeURIComponent(alert.sessionKey)}`}
                      className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block"
                    >
                      View Session
                    </Link>
                  )}
                </div>
                {alert.resolvedAt && (
                  <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">
                    Resolved
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
