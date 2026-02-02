interface ContextBarProps {
  used: number | null;
  max: number | null;
  percent: number | null;
  showLabels?: boolean;
}

export default function ContextBar({ used, max, percent, showLabels = false }: ContextBarProps) {
  if (percent === null) {
    return <span className="text-sm text-slate-500">N/A</span>;
  }

  const percentage = Math.round(percent * 100);
  const barColor =
    percentage >= 95 ? 'bg-red-500' :
    percentage >= 80 ? 'bg-yellow-500' :
    percentage >= 50 ? 'bg-blue-500' :
    'bg-green-500';

  return (
    <div className={showLabels ? 'space-y-2' : ''}>
      {showLabels && (
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">
            {used?.toLocaleString() ?? '?'} / {max?.toLocaleString() ?? '?'} tokens
          </span>
          <span className={`font-medium ${
            percentage >= 95 ? 'text-red-400' :
            percentage >= 80 ? 'text-yellow-400' :
            'text-slate-300'
          }`}>
            {percentage}%
          </span>
        </div>
      )}
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {!showLabels && (
        <span className={`text-xs ml-2 ${
          percentage >= 95 ? 'text-red-400' :
          percentage >= 80 ? 'text-yellow-400' :
          'text-slate-400'
        }`}>
          {percentage}%
        </span>
      )}
    </div>
  );
}
