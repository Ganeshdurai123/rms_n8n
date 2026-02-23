import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useCalendarData } from '@/components/calendar/useCalendarData';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import type { CalendarViewMode } from '@/components/calendar/useCalendarData';

export function CalendarViewPage() {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [programName, setProgramName] = useState('');
  const [programLoading, setProgramLoading] = useState(true);

  // Fetch program name
  useEffect(() => {
    if (!programId) return;
    let cancelled = false;

    async function fetchProgram() {
      setProgramLoading(true);
      try {
        const { data } = await api.get(`/programs/${programId}`);
        if (!cancelled) {
          const prog = data.data || data;
          setProgramName(prog.name || '');
        }
      } catch {
        // Ignore -- programName will be empty
      } finally {
        if (!cancelled) setProgramLoading(false);
      }
    }

    fetchProgram();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  const { requestsByDate, isLoading, error, dateRange } = useCalendarData(
    programId || '',
    viewDate,
    viewMode,
  );

  function navigatePrev() {
    setViewDate((prev) => {
      const d = new Date(prev);
      if (viewMode === 'month') {
        d.setMonth(d.getMonth() - 1);
      } else {
        d.setDate(d.getDate() - 7);
      }
      return d;
    });
  }

  function navigateNext() {
    setViewDate((prev) => {
      const d = new Date(prev);
      if (viewMode === 'month') {
        d.setMonth(d.getMonth() + 1);
      } else {
        d.setDate(d.getDate() + 7);
      }
      return d;
    });
  }

  function navigateToday() {
    setViewDate(new Date());
  }

  const headerLabel =
    viewMode === 'month'
      ? viewDate.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
        })
      : `${dateRange.start.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        })} - ${dateRange.end.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}`;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/programs/${programId}/sheet`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Sheet
          </Button>
          <div>
            {programLoading ? (
              <Skeleton className="h-7 w-40" />
            ) : (
              <h1 className="text-2xl font-bold">{programName}</h1>
            )}
            <p className="text-muted-foreground text-sm">Calendar View</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'month'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between px-6 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={navigateToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-lg font-semibold">{headerLabel}</h2>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-2 rounded-md mb-4">
            {error}
          </div>
        )}
        {isLoading ? (
          <div className="space-y-2">
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-[100px] w-full" />
              ))}
            </div>
          </div>
        ) : (
          <CalendarGrid
            requestsByDate={requestsByDate}
            dateRange={dateRange}
            viewMode={viewMode}
            viewDate={viewDate}
            onRequestClick={(req) =>
              navigate(`/programs/${programId}/requests/${req._id}`)
            }
          />
        )}
      </div>
    </div>
  );
}
