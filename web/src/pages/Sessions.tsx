import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSessions, useGateways } from '../hooks/useApi';
import StatusBadge from '../components/StatusBadge';
import ContextBar from '../components/ContextBar';

type StatusFilter = 'all' | 'active' | 'idle' | 'error' | 'ended';

export default function Sessions() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [gatewayFilter, setGatewayFilter] = useState<string>('');

  const { data: sessionsData, loading, refetch } = useSessions({
    status: statusFilter === 'all' ? undefined : statusFilter,
    gatewayId: gatewayFilter || undefined,
  });
  const { data: gatewaysData } = useGateways();

  const sessions = sessionsData?.sessions || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Sessions</h1>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex gap-2">
          {(['all', 'active', 'idle', 'error', 'ended'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <select
          value={gatewayFilter}
          onChange={(e) => setGatewayFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Gateways</option>
          {gatewaysData?.gateways.map(gw => (
            <option key={gw.id} value={gw.id}>{gw.name || gw.id}</option>
          ))}
        </select>
      </div>

      {/* Sessions Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            No sessions found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Session
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Gateway
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Turns
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Context
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Last Activity
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sessions.map(session => (
                  <tr key={session.sessionKey} className="hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to={`/sessions/${encodeURIComponent(session.sessionKey)}`}
                        className="text-blue-400 hover:text-blue-300 font-mono text-sm"
                      >
                        {session.sessionKey.length > 24
                          ? `${session.sessionKey.slice(0, 12)}...${session.sessionKey.slice(-8)}`
                          : session.sessionKey}
                      </Link>
                      {session.parentSessionKey && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          Subagent
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {session.gatewayId}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {session.turnCount}
                      {session.errorCount > 0 && (
                        <span className="text-red-400 ml-1">
                          ({session.errorCount} errors)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ContextBar
                        used={session.maxContextUsed}
                        max={session.contextMax}
                        percent={session.maxContextPercent}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      ${session.totalCost.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {formatRelativeTime(session.lastEventAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-sm text-slate-400">
        Showing {sessions.length} sessions
      </div>
    </div>
  );
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
