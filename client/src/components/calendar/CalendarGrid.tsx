import { cn } from '@/lib/utils';
import type { RequestItem } from '@/lib/types';
import type { CalendarViewMode } from './useCalendarData';

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-gray-400',
  todo: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  completed: 'bg-green-500',
};

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CalendarGridProps {
  requestsByDate: Map<string, RequestItem[]>;
  dateRange: { start: Date; end: Date };
  viewMode: CalendarViewMode;
  viewDate: Date;
  onRequestClick: (request: RequestItem) => void;
}

function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isSameMonth(date: Date, viewDate: Date): boolean {
  return (
    date.getFullYear() === viewDate.getFullYear() &&
    date.getMonth() === viewDate.getMonth()
  );
}

function isToday(date: Date): boolean {
  const today = new Date();
  return toDateKey(date) === toDateKey(today);
}

function getDaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  while (current <= endDay) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function RequestItem_({
  request,
  compact,
  onClick,
}: {
  request: RequestItem;
  compact: boolean;
  onClick: () => void;
}) {
  const dotColor = STATUS_DOT[request.status] || 'bg-gray-400';
  const title = compact
    ? request.title.length > 20
      ? request.title.substring(0, 20) + '...'
      : request.title
    : request.title;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex items-center gap-1 w-full text-left text-xs px-1 py-0.5 rounded hover:bg-accent truncate"
      title={request.title}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
      <span className="truncate">{title}</span>
    </button>
  );
}

function DayCell({
  date,
  requests,
  viewMode,
  viewDate,
  onRequestClick,
}: {
  date: Date;
  requests: RequestItem[];
  viewMode: CalendarViewMode;
  viewDate: Date;
  onRequestClick: (request: RequestItem) => void;
}) {
  const today = isToday(date);
  const inMonth = viewMode === 'month' ? isSameMonth(date, viewDate) : true;
  const maxItems = viewMode === 'month' ? 3 : 6;
  const visibleRequests = requests.slice(0, maxItems);
  const overflow = requests.length - maxItems;

  return (
    <div
      className={cn(
        'border border-border p-1 flex flex-col',
        viewMode === 'month' ? 'min-h-[100px]' : 'min-h-[180px]',
        today && 'ring-2 ring-primary bg-primary/5',
        !inMonth && 'opacity-50',
      )}
    >
      <span
        className={cn(
          'text-xs font-medium mb-0.5 px-0.5',
          today && 'text-primary font-bold',
          !inMonth && 'text-muted-foreground',
        )}
      >
        {date.getDate()}
      </span>
      <div className="flex-1 space-y-0.5 overflow-hidden">
        {visibleRequests.map((req) => (
          <RequestItem_
            key={req._id}
            request={req}
            compact={viewMode === 'month'}
            onClick={() => onRequestClick(req)}
          />
        ))}
        {overflow > 0 && (
          <span className="text-[10px] text-muted-foreground px-1">
            +{overflow} more
          </span>
        )}
      </div>
    </div>
  );
}

export function CalendarGrid({
  requestsByDate,
  dateRange,
  viewMode,
  viewDate,
  onRequestClick,
}: CalendarGridProps) {
  const days = getDaysInRange(dateRange.start, dateRange.end);

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-semibold text-muted-foreground py-1"
          >
            {day}
          </div>
        ))}
      </div>
      {/* Day cells grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = toDateKey(day);
          const reqs = requestsByDate.get(key) || [];
          return (
            <DayCell
              key={key}
              date={day}
              requests={reqs}
              viewMode={viewMode}
              viewDate={viewDate}
              onRequestClick={onRequestClick}
            />
          );
        })}
      </div>
    </div>
  );
}
