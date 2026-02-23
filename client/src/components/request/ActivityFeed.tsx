import { useState, useMemo } from 'react';
import { useSocket } from '@/lib/socket';
import {
  FileText,
  RefreshCw,
  UserCheck,
  Trash2,
  MessageSquare,
  Paperclip,
  Bell,
  Radio,
} from 'lucide-react';

interface ActivityEvent {
  id: string;
  event: string;
  programId: string;
  requestId: string;
  performedBy: { userId: string; name: string };
  data: Record<string, unknown>;
  timestamp: string;
}

const MAX_EVENTS = 20;

/** Map event type to a human-readable action description */
function describeEvent(evt: ActivityEvent): string {
  const name = evt.performedBy?.name || 'Someone';

  switch (evt.event) {
    case 'request:created':
      return `${name} created a request`;
    case 'request:updated':
      return `${name} updated a request`;
    case 'request:status_changed': {
      const to = evt.data?.to || evt.data?.status || 'unknown';
      return `${name} changed status to ${String(to).replace('_', ' ')}`;
    }
    case 'request:assigned': {
      const assignee = evt.data?.assigneeName || 'someone';
      return `${name} assigned request to ${String(assignee)}`;
    }
    case 'request:deleted':
      return `${name} deleted a request`;
    case 'comment:added':
      return `${name} added a comment`;
    case 'comment:deleted':
      return `${name} deleted a comment`;
    case 'attachment:uploaded':
      return `${name} uploaded an attachment`;
    case 'attachment:deleted':
      return `${name} deleted an attachment`;
    case 'notification:created':
      return `${name} triggered a notification`;
    default:
      return `${name} performed an action`;
  }
}

/** Map event type to an icon component */
function EventIcon({ event }: { event: string }) {
  const iconClass = 'h-4 w-4 shrink-0';

  switch (event) {
    case 'request:created':
      return <FileText className={`${iconClass} text-green-500`} />;
    case 'request:updated':
      return <RefreshCw className={`${iconClass} text-blue-500`} />;
    case 'request:status_changed':
      return <RefreshCw className={`${iconClass} text-orange-500`} />;
    case 'request:assigned':
      return <UserCheck className={`${iconClass} text-purple-500`} />;
    case 'request:deleted':
      return <Trash2 className={`${iconClass} text-red-500`} />;
    case 'comment:added':
    case 'comment:deleted':
      return <MessageSquare className={`${iconClass} text-cyan-500`} />;
    case 'attachment:uploaded':
    case 'attachment:deleted':
      return <Paperclip className={`${iconClass} text-teal-500`} />;
    case 'notification:created':
      return <Bell className={`${iconClass} text-yellow-500`} />;
    default:
      return <Radio className={`${iconClass} text-muted-foreground`} />;
  }
}

/** Format a timestamp into a relative time string (e.g. "2m ago") */
function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  return `${Math.floor(diffHr / 24)}d ago`;
}

interface ActivityFeedProps {
  programId: string;
}

/**
 * Live activity feed that shows real-time Socket.IO events within a program.
 * Starts empty on page load and fills as events arrive.
 */
export function ActivityFeed({ programId }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  // Build handlers that filter events for this program
  const socketEvents = useMemo(() => {
    const handleEvent = (payload: Record<string, unknown>) => {
      // Only show events for the current program
      if (payload.programId !== programId) return;

      const newEvent: ActivityEvent = {
        id: `${payload.event}-${payload.requestId}-${payload.timestamp || Date.now()}`,
        event: String(payload.event || ''),
        programId: String(payload.programId || ''),
        requestId: String(payload.requestId || ''),
        performedBy: (payload.performedBy as ActivityEvent['performedBy']) || {
          userId: '',
          name: 'Unknown',
        },
        data: (payload.data as Record<string, unknown>) || {},
        timestamp: String(payload.timestamp || new Date().toISOString()),
      };

      setEvents((prev) => [newEvent, ...prev].slice(0, MAX_EVENTS));
    };

    return {
      'request:created': handleEvent,
      'request:updated': handleEvent,
      'request:status_changed': handleEvent,
      'request:assigned': handleEvent,
      'request:deleted': handleEvent,
      'comment:added': handleEvent,
      'comment:deleted': handleEvent,
      'attachment:uploaded': handleEvent,
      'attachment:deleted': handleEvent,
      'notification:created': handleEvent,
    };
  }, [programId]);

  useSocket(socketEvents);

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
        <Radio className="h-3.5 w-3.5" />
        Recent Activity
      </h3>

      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No activity yet. Events will appear here in real time.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {events.map((evt) => (
            <li
              key={evt.id}
              className="flex items-start gap-2 text-sm leading-tight"
            >
              <EventIcon event={evt.event} />
              <span className="flex-1 text-foreground/90">
                {describeEvent(evt)}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {relativeTime(evt.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
