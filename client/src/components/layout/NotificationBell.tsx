import { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useSocket } from '@/lib/socket';
import type { Notification, PaginatedResponse } from '@/lib/types';

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

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch notifications and unread count on mount
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        api.get<PaginatedResponse<Notification>>('/notifications', {
          params: { limit: 10, page: 1 },
        }),
        api.get<{ count: number }>('/notifications/unread-count'),
      ]);
      setNotifications(listRes.data.data);
      setUnreadCount(countRes.data.count);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Polling fallback: re-fetch unread count every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get<{ count: number }>('/notifications/unread-count');
        setUnreadCount(data.count);
      } catch (err) {
        console.error('Failed to poll unread count:', err);
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  // Socket listener for real-time notifications
  useSocket({
    'notification:created': (payload: Record<string, unknown>) => {
      const notif = payload.data as unknown as Notification | undefined;
      if (notif && notif._id) {
        setNotifications((prev) => [notif, ...prev].slice(0, 10));
        setUnreadCount((prev) => prev + 1);
      } else {
        // Payload might be the notification itself (not nested under data)
        const directNotif = payload as unknown as Notification;
        if (directNotif && directNotif._id) {
          setNotifications((prev) => [directNotif, ...prev].slice(0, 10));
          setUnreadCount((prev) => prev + 1);
        }
      }
    },
  });

  // Mark a single notification as read
  const handleMarkRead = useCallback(async (notification: Notification) => {
    if (notification.isRead) return;
    try {
      await api.patch(`/notifications/${notification._id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notification._id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  // Mark all notifications as read
  const handleMarkAllRead = useCallback(async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : notifications.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </p>
          ) : (
            notifications.map((n) => (
              <div
                key={n._id}
                onClick={() => handleMarkRead(n)}
                className={cn(
                  'flex cursor-pointer flex-col gap-0.5 border-b px-4 py-2.5 transition-colors last:border-b-0 hover:bg-accent/50',
                  !n.isRead && 'bg-accent/30',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="flex-1 truncate text-sm font-medium">
                    {n.title}
                  </span>
                  {!n.isRead && (
                    <span className="ml-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {n.message}
                </p>
                <span className="mt-0.5 text-[10px] text-muted-foreground">
                  {relativeTime(n.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 text-center">
          <a
            href="/notifications"
            className="text-xs text-primary hover:underline"
          >
            View all
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
