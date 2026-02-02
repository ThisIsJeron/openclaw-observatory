import { useMetrics, useHourlyMetrics, useGateways, useSessions } from '../hooks/useApi';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';

export default function Overview() {
  const { data: metrics, loading: metricsLoading } = useMetrics();
  const { data: hourlyData } = useHourlyMetrics(24);
  const { data: gatewaysData } = useGateways();
  const { data: activeSessionsData } = useSessions({ status: 'active' });

  // Prepare chart data
  const chartData = hourlyData?.metrics
    ?.slice()
    .reverse()
    .map(m => ({
      time: new Date(m.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      turns: m.turns,
      errors: m.errors,
      cost: m.totalCost,
      context: Math.round(m.avgContextPct * 100),
    })) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Sessions"
          value={metrics?.activeSessions ?? '-'}
          subtitle={`${metrics?.totalSessions ?? 0} total (24h)`}
          loading={metricsLoading}
          color="blue"
        />
        <MetricCard
          title="Turns/Hour"
          value={metrics?.turnsPerHour ?? '-'}
          subtitle={`${metrics?.totalTurns ?? 0} total (24h)`}
          loading={metricsLoading}
          color="green"
        />
        <MetricCard
          title="Errors/Hour"
          value={metrics?.errorsPerHour ?? '-'}
          subtitle={`${metrics?.totalErrors ?? 0} total (24h)`}
          loading={metricsLoading}
          color="red"
        />
        <MetricCard
          title="Cost/Hour"
          value={metrics?.costPerHour !== undefined ? `$${metrics.costPerHour.toFixed(2)}` : '-'}
          subtitle={`$${(metrics?.totalCost ?? 0).toFixed(2)} total (24h)`}
          loading={metricsLoading}
          color="yellow"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Turns over time */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Turns Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Line type="monotone" dataKey="turns" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Context usage */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Avg Context Usage (%)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Bar dataKey="context" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Active Sessions and Gateways */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Sessions */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Active Sessions</h3>
          {activeSessionsData?.sessions && activeSessionsData.sessions.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activeSessionsData.sessions.slice(0, 10).map(session => (
                <a
                  key={session.sessionKey}
                  href={`/sessions/${encodeURIComponent(session.sessionKey)}`}
                  className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-white truncate max-w-[200px]">
                      {session.sessionKey}
                    </div>
                    <div className="text-xs text-slate-400">
                      {session.gatewayId} · {session.turnCount} turns
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={session.status} />
                    {session.maxContextPercent !== null && (
                      <div className={`text-xs px-2 py-0.5 rounded ${
                        session.maxContextPercent > 0.8
                          ? 'bg-red-900/50 text-red-400'
                          : session.maxContextPercent > 0.5
                          ? 'bg-yellow-900/50 text-yellow-400'
                          : 'bg-slate-600 text-slate-300'
                      }`}>
                        {Math.round(session.maxContextPercent * 100)}%
                      </div>
                    )}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">No active sessions</p>
          )}
        </div>

        {/* Gateways */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Connected Gateways</h3>
          {gatewaysData?.gateways && gatewaysData.gateways.length > 0 ? (
            <div className="space-y-2">
              {gatewaysData.gateways.map(gateway => {
                const isOnline = new Date(gateway.lastSeen).getTime() > Date.now() - 5 * 60 * 1000;
                return (
                  <div
                    key={gateway.id}
                    className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">
                        {gateway.name || gateway.id}
                      </div>
                      <div className="text-xs text-slate-400">
                        {gateway.eventCount.toLocaleString()} events
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${
                      isOnline ? 'text-green-400' : 'text-slate-400'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        isOnline ? 'bg-green-400' : 'bg-slate-500'
                      }`} />
                      {isOnline ? 'Online' : 'Offline'}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">No gateways registered</p>
          )}
        </div>
      </div>
    </div>
  );
}
