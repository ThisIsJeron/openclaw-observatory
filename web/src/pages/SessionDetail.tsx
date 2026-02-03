import { useParams, Link } from 'react-router-dom';
import { useSession, useSessionEvents } from '../hooks/useApi';
import StatusBadge from '../components/StatusBadge';
import ContextBar from '../components/ContextBar';
import EventTimeline from '../components/EventTimeline';
import TurnMetricsChart from '../components/TurnMetricsChart';

export default function SessionDetail() {
  const { sessionKey } = useParams<{ sessionKey: string }>();
  const { data: session, loading: sessionLoading, error: sessionError } = useSession(sessionKey || '');
  const { data: eventsData, loading: eventsLoading } = useSessionEvents(sessionKey || '');

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-white mb-2">Session Not Found</h2>
        <p className="text-slate-400 mb-4">The session could not be found or has been deleted.</p>
        <Link to="/sessions" className="text-blue-400 hover:text-blue-300">
          Back to Sessions
        </Link>
      </div>
    );
  }

  const events = eventsData?.events || [];

  // Compute derived metrics from events
  const turnEvents = events.filter((e) => e.eventType === 'turn.completed');
  const totalTokens = turnEvents.reduce((sum, e) => {
    return sum + (e.tokens?.input ?? 0) + (e.tokens?.output ?? 0);
  }, 0);
  const avgCostPerTurn = session.turnCount > 0 ? session.totalCost / session.turnCount : 0;
  const avgTokensPerTurn = turnEvents.length > 0 ? totalTokens / turnEvents.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link to="/sessions" className="text-slate-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-white font-mono">
              {session.sessionKey}
            </h1>
            <StatusBadge status={session.status} />
          </div>
          {session.parentSessionKey && (
            <p className="text-slate-400 text-sm">
              Subagent of{' '}
              <Link
                to={`/sessions/${encodeURIComponent(session.parentSessionKey)}`}
                className="text-blue-400 hover:text-blue-300"
              >
                {session.parentSessionKey}
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Gateway</div>
          <div className="text-lg font-medium text-white">{session.gatewayId}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Channel</div>
          <div className="text-lg font-medium text-white">{session.channel || 'N/A'}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Turns</div>
          <div className="text-lg font-medium text-white">
            {session.turnCount}
            {session.errorCount > 0 && (
              <span className="text-sm text-red-400 ml-2">({session.errorCount} errors)</span>
            )}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Total Cost</div>
          <div className="text-lg font-medium text-white">${session.totalCost.toFixed(4)}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Total Tokens</div>
          <div className="text-lg font-medium text-white">{totalTokens.toLocaleString()}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Avg Cost/Turn</div>
          <div className="text-lg font-medium text-white">${avgCostPerTurn.toFixed(4)}</div>
        </div>
      </div>

      {/* Context Usage */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="text-sm text-slate-400 mb-3">Context Usage</div>
        <ContextBar
          used={session.maxContextUsed}
          max={session.contextMax}
          percent={session.maxContextPercent}
          showLabels
        />
      </div>

      {/* Turn Metrics Chart */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Turn Metrics</h2>
          {turnEvents.length > 0 && (
            <div className="flex gap-4 text-sm text-slate-400">
              <span>Avg {avgTokensPerTurn.toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens/turn</span>
              <span>Avg ${avgCostPerTurn.toFixed(4)}/turn</span>
            </div>
          )}
        </div>
        <TurnMetricsChart events={events} />
      </div>

      {/* Timeline */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Event Timeline</h2>
          <span className="text-sm text-slate-400">{events.length} events</span>
        </div>
        {eventsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No events recorded</p>
        ) : (
          <EventTimeline events={events} />
        )}
      </div>

      {/* Session Metadata */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Session Info</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-400">Started</dt>
            <dd className="text-white">{new Date(session.startedAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Last Activity</dt>
            <dd className="text-white">{new Date(session.lastEventAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Agent ID</dt>
            <dd className="text-white font-mono">{session.agentId || 'N/A'}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Total Events</dt>
            <dd className="text-white">{session.eventCount}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
