interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  loading?: boolean;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
}

const colorStyles = {
  blue: 'bg-blue-900/20 border-blue-800',
  green: 'bg-green-900/20 border-green-800',
  red: 'bg-red-900/20 border-red-800',
  yellow: 'bg-yellow-900/20 border-yellow-800',
  purple: 'bg-purple-900/20 border-purple-800',
};

const valueColors = {
  blue: 'text-blue-400',
  green: 'text-green-400',
  red: 'text-red-400',
  yellow: 'text-yellow-400',
  purple: 'text-purple-400',
};

export default function MetricCard({
  title,
  value,
  subtitle,
  loading = false,
  color = 'blue',
}: MetricCardProps) {
  return (
    <div className={`rounded-lg border p-4 ${colorStyles[color]}`}>
      <div className="text-sm text-slate-400 mb-1">{title}</div>
      {loading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded w-16" />
        </div>
      ) : (
        <>
          <div className={`text-3xl font-bold ${valueColors[color]}`}>{value}</div>
          {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
        </>
      )}
    </div>
  );
}
