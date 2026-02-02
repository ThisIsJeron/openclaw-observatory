interface StatusBadgeProps {
  status: 'active' | 'idle' | 'error' | 'ended';
}

const statusStyles = {
  active: 'bg-green-900/50 text-green-400 border-green-700',
  idle: 'bg-slate-700 text-slate-400 border-slate-600',
  error: 'bg-red-900/50 text-red-400 border-red-700',
  ended: 'bg-slate-800 text-slate-500 border-slate-700',
};

const statusDots = {
  active: 'bg-green-400',
  idle: 'bg-slate-400',
  error: 'bg-red-400',
  ended: 'bg-slate-500',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border ${statusStyles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${statusDots[status]} ${status === 'active' ? 'animate-pulse' : ''}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
