import type { SessionEvent } from '../hooks/useApi';
import { useState } from 'react';

interface EventTimelineProps {
  events: SessionEvent[];
}

const eventTypeStyles: Record<string, { bg: string; icon: string; color: string }> = {
  'session.created': { bg: 'bg-blue-500', icon: '+', color: 'text-blue-400' },
  'session.ended': { bg: 'bg-slate-500', icon: 'x', color: 'text-slate-400' },
  'turn.started': { bg: 'bg-green-500', icon: '>', color: 'text-green-400' },
  'turn.completed': { bg: 'bg-green-600', icon: 'v', color: 'text-green-400' },
  'turn.failed': { bg: 'bg-red-500', icon: '!', color: 'text-red-400' },
  'tool.invoked': { bg: 'bg-purple-500', icon: 'T', color: 'text-purple-400' },
  'tool.completed': { bg: 'bg-purple-600', icon: 'v', color: 'text-purple-400' },
  'tool.failed': { bg: 'bg-red-500', icon: 'x', color: 'text-red-400' },
  'subagent.spawned': { bg: 'bg-cyan-500', icon: '>', color: 'text-cyan-400' },
  'subagent.completed': { bg: 'bg-cyan-600', icon: 'v', color: 'text-cyan-400' },
  'subagent.failed': { bg: 'bg-red-500', icon: 'x', color: 'text-red-400' },
  'context.warning': { bg: 'bg-yellow-500', icon: '!', color: 'text-yellow-400' },
  'context.overflow': { bg: 'bg-red-500', icon: '!', color: 'text-red-400' },
};

function getEventStyle(eventType: string) {
  return eventTypeStyles[eventType] || { bg: 'bg-slate-500', icon: '?', color: 'text-slate-400' };
}

export default function EventTimeline({ events }: EventTimelineProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const toggleExpand = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-0 relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-700" />

      {events.map((event, index) => {
        const style = getEventStyle(event.eventType);
        const isExpanded = expandedEvents.has(event.id);
        const hasDetails = event.tokens || event.timing || event.tool || event.error || event.payload;

        return (
          <div key={event.id} className="relative pl-10 pb-4">
            {/* Timeline dot */}
            <div
              className={`absolute left-2.5 w-3.5 h-3.5 rounded-full ${style.bg} border-2 border-slate-800`}
              style={{ top: '4px' }}
            />

            {/* Event card */}
            <div
              className={`bg-slate-700/50 rounded-lg p-3 ${hasDetails ? 'cursor-pointer hover:bg-slate-700' : ''}`}
              onClick={() => hasDetails && toggleExpand(event.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${style.color}`}>
                    {event.eventType}
                  </span>
                  {event.tool && (
                    <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded">
                      {event.tool.name}
                    </span>
                  )}
                  {event.error && (
                    <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded">
                      {event.error.type}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  {event.timing?.durationMs !== null && event.timing?.durationMs !== undefined && (
                    <span>{event.timing.durationMs}ms</span>
                  )}
                  {event.tokens?.percentUsed !== null && event.tokens?.percentUsed !== undefined && (
                    <span className={
                      event.tokens.percentUsed >= 0.95 ? 'text-red-400' :
                      event.tokens.percentUsed >= 0.8 ? 'text-yellow-400' :
                      'text-slate-400'
                    }>
                      {Math.round(event.tokens.percentUsed * 100)}% ctx
                    </span>
                  )}
                  {event.cost?.totalCost !== null && event.cost?.totalCost !== undefined && (
                    <span>${event.cost.totalCost.toFixed(4)}</span>
                  )}
                  <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                  {hasDetails && (
                    <svg
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && hasDetails && (
                <div className="mt-3 pt-3 border-t border-slate-600 space-y-3">
                  {event.tokens && (
                    <div>
                      <div className="text-xs font-medium text-slate-400 mb-1">Tokens</div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500">Input:</span>{' '}
                          <span className="text-slate-300">{event.tokens.input?.toLocaleString() ?? 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Output:</span>{' '}
                          <span className="text-slate-300">{event.tokens.output?.toLocaleString() ?? 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Context:</span>{' '}
                          <span className="text-slate-300">
                            {event.tokens.contextUsed?.toLocaleString() ?? 'N/A'} / {event.tokens.contextMax?.toLocaleString() ?? 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Usage:</span>{' '}
                          <span className={
                            (event.tokens.percentUsed ?? 0) >= 0.95 ? 'text-red-400' :
                            (event.tokens.percentUsed ?? 0) >= 0.8 ? 'text-yellow-400' :
                            'text-slate-300'
                          }>
                            {event.tokens.percentUsed !== null ? `${Math.round(event.tokens.percentUsed * 100)}%` : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {event.timing && (
                    <div>
                      <div className="text-xs font-medium text-slate-400 mb-1">Timing</div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500">Duration:</span>{' '}
                          <span className="text-slate-300">{event.timing.durationMs ?? 'N/A'}ms</span>
                        </div>
                        {event.timing.ttftMs !== null && (
                          <div>
                            <span className="text-slate-500">TTFT:</span>{' '}
                            <span className="text-slate-300">{event.timing.ttftMs}ms</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {event.model && (
                    <div>
                      <div className="text-xs font-medium text-slate-400 mb-1">Model</div>
                      <div className="text-xs">
                        <span className="text-slate-300">{event.model.provider}</span>
                        <span className="text-slate-500"> / </span>
                        <span className="text-slate-300 font-mono">{event.model.modelId}</span>
                      </div>
                    </div>
                  )}

                  {event.tool && (
                    <div>
                      <div className="text-xs font-medium text-slate-400 mb-1">Tool</div>
                      <div className="text-xs">
                        <span className="text-purple-400 font-mono">{event.tool.name}</span>
                        {event.tool.error && (
                          <span className="text-red-400 ml-2">Error: {event.tool.error}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {event.error && (
                    <div>
                      <div className="text-xs font-medium text-red-400 mb-1">Error</div>
                      <div className="text-xs text-red-300 bg-red-900/30 rounded p-2">
                        <div className="font-medium">{event.error.type}</div>
                        {event.error.message && <div className="mt-1">{event.error.message}</div>}
                      </div>
                    </div>
                  )}

                  {event.payload && Object.keys(event.payload).length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-slate-400 mb-1">Payload</div>
                      <pre className="text-xs text-slate-300 bg-slate-800 rounded p-2 overflow-x-auto max-h-32">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
