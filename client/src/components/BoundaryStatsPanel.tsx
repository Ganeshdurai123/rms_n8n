import { useState, useEffect } from 'react';
import api from '@/lib/api';
import type { BoundaryStats } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

interface BoundaryStatsPanelProps {
  programId: string;
  userRole: string;
}

function getUtilizationColor(current: number, max: number): string {
  const pct = (current / max) * 100;
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-orange-500';
  return 'bg-green-500';
}

function getUtilizationTextColor(current: number, max: number): string {
  const pct = (current / max) * 100;
  if (pct >= 90) return 'text-red-600';
  if (pct >= 70) return 'text-orange-600';
  return 'text-green-600';
}

function UtilizationBar({ current, max }: { current: number; max: number }) {
  const pct = Math.min((current / max) * 100, 100);
  const widthPct = Math.max(pct, 2); // min 2% for visibility

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getUtilizationColor(current, max)}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className={`text-xs font-medium whitespace-nowrap ${getUtilizationTextColor(current, max)}`}>
        {current}/{max} ({Math.round(pct)}%)
      </span>
    </div>
  );
}

export function BoundaryStatsPanel({ programId, userRole }: BoundaryStatsPanelProps) {
  // Only admin/manager can see boundary stats
  if (userRole !== 'admin' && userRole !== 'manager') return null;

  const [stats, setStats] = useState<BoundaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    async function fetchStats() {
      try {
        const { data } = await api.get(`/programs/${programId}/boundary-stats`);
        if (!cancelled) {
          setStats(data.data || data);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load boundary stats.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!stats) return null;

  const { limits, usage } = stats;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <h3 className="text-sm font-semibold">Boundary Utilization</h3>

      {/* Program-wide limit section */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Program-wide Active Requests</p>
        {limits.maxActiveRequests !== null ? (
          <UtilizationBar current={usage.totalActiveRequests} max={limits.maxActiveRequests} />
        ) : (
          <p className="text-xs text-muted-foreground italic">No program-wide limit set</p>
        )}
      </div>

      {/* Per-user limit section */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Per-User Active Requests</p>
        {limits.maxActiveRequestsPerUser !== null ? (
          usage.perUser.length > 0 ? (
            <div className="rounded border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-3 py-1.5 text-xs font-medium text-muted-foreground">User</th>
                    <th className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Email</th>
                    <th className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Active</th>
                    <th className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Limit</th>
                    <th className="px-3 py-1.5 text-xs font-medium text-muted-foreground w-1/3">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.perUser.map((u) => {
                    const pct = Math.min((u.activeCount / limits.maxActiveRequestsPerUser!) * 100, 100);
                    const widthPct = Math.max(pct, 2);
                    return (
                      <tr key={u.userId} className="border-t">
                        <td className="px-3 py-1.5 text-xs">{u.name}</td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">{u.email || '-'}</td>
                        <td className="px-3 py-1.5 text-xs font-medium">{u.activeCount}</td>
                        <td className="px-3 py-1.5 text-xs">{limits.maxActiveRequestsPerUser}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getUtilizationColor(u.activeCount, limits.maxActiveRequestsPerUser!)}`}
                                style={{ width: `${widthPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {Math.round(pct)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No active requests from any user</p>
          )
        ) : (
          <p className="text-xs text-muted-foreground italic">No per-user limit set</p>
        )}
      </div>
    </div>
  );
}
