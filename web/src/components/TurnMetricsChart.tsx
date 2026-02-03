import type { SessionEvent } from '../hooks/useApi';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface TurnMetricsChartProps {
  events: SessionEvent[];
}

interface TurnData {
  turn: number;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  contextPct: number;
}

export default function TurnMetricsChart({ events }: TurnMetricsChartProps) {
  // Filter for turn.completed events which have token/cost data
  const turnEvents = events.filter((e) => e.eventType === 'turn.completed');

  if (turnEvents.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-400">
        No turn data available
      </div>
    );
  }

  // Transform to chart-friendly format
  const chartData: TurnData[] = turnEvents.map((event, index) => ({
    turn: index + 1,
    tokensIn: event.tokens?.input ?? 0,
    tokensOut: event.tokens?.output ?? 0,
    cost: event.cost?.totalCost ?? 0,
    contextPct: (event.tokens?.percentUsed ?? 0) * 100,
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string | number;
  }) => {
    if (!active || !payload || !payload.length) return null;

    const data = chartData.find((d) => d.turn === label);
    if (!data) return null;

    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
        <div className="text-sm font-medium text-white mb-2">Turn {label}</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-blue-400">Input Tokens:</span>
            <span className="text-slate-300">{data.tokensIn.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-green-400">Output Tokens:</span>
            <span className="text-slate-300">{data.tokensOut.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-purple-400">Cost:</span>
            <span className="text-slate-300">${data.cost.toFixed(4)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className={
              data.contextPct >= 95 ? 'text-red-400' :
              data.contextPct >= 80 ? 'text-yellow-400' :
              'text-slate-400'
            }>Context:</span>
            <span className={
              data.contextPct >= 95 ? 'text-red-400' :
              data.contextPct >= 80 ? 'text-yellow-400' :
              'text-slate-300'
            }>{data.contextPct.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="turn"
          stroke="#94a3b8"
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          label={{ value: 'Turn', position: 'insideBottom', offset: -5, fill: '#94a3b8' }}
        />
        <YAxis
          yAxisId="tokens"
          stroke="#94a3b8"
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          label={{ value: 'Tokens', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
          tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
        />
        <YAxis
          yAxisId="context"
          orientation="right"
          stroke="#94a3b8"
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          domain={[0, 100]}
          label={{ value: 'Context %', angle: 90, position: 'insideRight', fill: '#94a3b8' }}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: '10px' }}
          formatter={(value) => <span className="text-slate-300 text-sm">{value}</span>}
        />

        {/* Warning thresholds for context usage */}
        <ReferenceLine yAxisId="context" y={80} stroke="#eab308" strokeDasharray="5 5" />
        <ReferenceLine yAxisId="context" y={95} stroke="#ef4444" strokeDasharray="5 5" />

        {/* Stacked bars for tokens */}
        <Bar
          yAxisId="tokens"
          dataKey="tokensIn"
          name="Input Tokens"
          stackId="tokens"
          fill="#3b82f6"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          yAxisId="tokens"
          dataKey="tokensOut"
          name="Output Tokens"
          stackId="tokens"
          fill="#22c55e"
          radius={[4, 4, 0, 0]}
        />

        {/* Line for context percentage */}
        <Line
          yAxisId="context"
          type="monotone"
          dataKey="contextPct"
          name="Context %"
          stroke="#a855f7"
          strokeWidth={2}
          dot={{ fill: '#a855f7', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: '#a855f7', strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
