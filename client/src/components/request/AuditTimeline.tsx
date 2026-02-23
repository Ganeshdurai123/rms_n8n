import type { AuditEntry } from '@/lib/types';

function getUserName(
  performer: AuditEntry['performedBy'],
): string {
  if (!performer || typeof performer === 'string') return 'System';
  return `${performer.firstName} ${performer.lastName}`;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return new Date(dateStr).toLocaleDateString();
}

const ACTION_LABELS: Record<string, string> = {
  'comment.added': 'Added a comment',
  'comment.deleted': 'Deleted a comment',
  'status.changed': 'Changed status',
  'request.created': 'Created the request',
  'request.updated': 'Updated the request',
  'request.deleted': 'Deleted the request',
  'attachment.uploaded': 'Uploaded an attachment',
  'attachment.deleted': 'Deleted an attachment',
  'assignment.changed': 'Changed assignee',
  'priority.changed': 'Changed priority',
};

function humanizeAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];

  // Fallback: "some.action" -> "Some action"
  const parts = action.split('.');
  const label = parts.join(' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getStatusChangeDetail(entry: AuditEntry): string | null {
  const before = entry.before as Record<string, unknown> | undefined;
  const after = entry.after as Record<string, unknown> | undefined;

  if (before?.status && after?.status) {
    const from = String(before.status).replace('_', ' ');
    const to = String(after.status).replace('_', ' ');
    return `${from} -> ${to}`;
  }
  return null;
}

interface AuditTimelineProps {
  auditTrail: AuditEntry[];
}

export function AuditTimeline({ auditTrail }: AuditTimelineProps) {
  if (auditTrail.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No audit history available.
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

      <div className="space-y-4">
        {auditTrail.map((entry) => {
          const statusDetail = getStatusChangeDetail(entry);

          return (
            <div key={entry._id} className="relative flex gap-4 pl-8">
              {/* Dot */}
              <div className="absolute left-[9px] top-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground" />

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-medium">
                    {getUserName(entry.performedBy)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {humanizeAction(entry.action)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {relativeTime(entry.createdAt)}
                  </span>
                </div>

                {statusDetail && (
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                    {statusDetail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
