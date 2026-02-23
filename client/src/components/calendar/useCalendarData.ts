import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import type { RequestItem } from '@/lib/types';

export type CalendarViewMode = 'month' | 'week';

interface CalendarDateRange {
  start: Date;
  end: Date;
}

interface UseCalendarDataReturn {
  requests: RequestItem[];
  requestsByDate: Map<string, RequestItem[]>;
  isLoading: boolean;
  error: string | null;
  dateRange: CalendarDateRange;
}

function getMonthRange(viewDate: Date): CalendarDateRange {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  // First day of month
  const start = new Date(year, month, 1);
  // Extend to cover the full week (Monday-based)
  const startDay = start.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = startDay === 0 ? 6 : startDay - 1;
  start.setDate(start.getDate() - mondayOffset);

  // Last day of month
  const end = new Date(year, month + 1, 0);
  // Extend to cover the full week (end on Sunday)
  const endDay = end.getDay(); // 0=Sun
  const sundayOffset = endDay === 0 ? 0 : 7 - endDay;
  end.setDate(end.getDate() + sundayOffset);
  // Set end to end of day
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getWeekRange(viewDate: Date): CalendarDateRange {
  const start = new Date(viewDate);
  const day = start.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - mondayOffset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function toDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export function useCalendarData(
  programId: string,
  viewDate: Date,
  viewMode: CalendarViewMode,
): UseCalendarDataReturn {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateRange = useMemo(() => {
    return viewMode === 'month'
      ? getMonthRange(viewDate)
      : getWeekRange(viewDate);
  }, [viewDate, viewMode]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;

    async function fetchRequests() {
      setIsLoading(true);
      setError(null);

      try {
        const params = {
          dueAfter: dateRange.start.toISOString(),
          dueBefore: dateRange.end.toISOString(),
          limit: 200,
        };
        const { data } = await api.get(`/programs/${programId}/requests`, {
          params,
        });
        if (!cancelled) {
          const items = data.data || data;
          setRequests(Array.isArray(items) ? items : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load calendar data',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchRequests();
    return () => {
      cancelled = true;
    };
  }, [programId, dateRange]);

  const requestsByDate = useMemo(() => {
    const map = new Map<string, RequestItem[]>();
    for (const req of requests) {
      if (!req.dueDate) continue;
      const key = toDateKey(req.dueDate);
      const existing = map.get(key) || [];
      existing.push(req);
      map.set(key, existing);
    }
    return map;
  }, [requests]);

  return { requests, requestsByDate, isLoading, error, dateRange };
}
