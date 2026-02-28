import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Check, Minus, UserPlus, Send, Play, CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import type { RequestDetail, FieldDefinition, ChecklistItem, Role } from '@/lib/types';

const STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  todo: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
};

const PRIORITY_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'secondary',
  medium: 'default',
  high: 'outline',
  urgent: 'destructive',
};

const PRIORITY_EXTRA_CLASS: Record<string, string> = {
  high: 'border-orange-400 text-orange-600 dark:text-orange-400',
};

function formatUserName(
  user: string | { _id: string; firstName: string; lastName: string; email?: string } | null | undefined,
  fallback = '-',
): string {
  if (!user) return fallback;
  if (typeof user === 'string') return user;
  return `${user.firstName} ${user.lastName}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getDueDateIndicator(dueDate: string): { label: string; className: string } {
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' };
  if (diffDays <= 3) return { label: `Due in ${diffDays}d`, className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' };
  return { label: `Due in ${diffDays}d`, className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' };
}

function formatFieldValue(value: unknown, type: string): string {
  if (value === undefined || value === null) return '-';
  switch (type) {
    case 'checkbox':
      return value === true || value === 'true' ? 'Yes' : 'No';
    case 'checklist':
      if (!Array.isArray(value)) return '-';
      {
        const total = value.length;
        const checked = (value as ChecklistItem[]).filter((item) => item.checked).length;
        const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;
        return `${checked} of ${total} completed (${percentage}%)`;
      }
    case 'date':
      try {
        return new Date(String(value)).toLocaleDateString();
      } catch {
        return String(value);
      }
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    default:
      return String(value);
  }
}

interface RequestInfoProps {
  detail: RequestDetail;
  canAssign?: boolean;
  onAssignClick?: () => void;
  userRole?: Role;
  userId?: string;
  onRefresh?: () => void;
}

export function RequestInfo({ detail, canAssign, onAssignClick, userRole, userId, onRefresh }: RequestInfoProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { request } = detail;
  const program = request.programId;

  const creatorId = request.createdBy
    ? typeof request.createdBy === 'string'
      ? request.createdBy
      : request.createdBy._id
    : '';

  const isCreator = creatorId === userId;
  const canSubmit = request.status === 'draft' && isCreator;
  const canStart = request.status === 'todo' && (userRole === 'admin' || userRole === 'manager' || userRole === 'team_member');
  const canComplete = request.status === 'in_progress' && (userRole === 'admin' || userRole === 'manager' || userRole === 'team_member');

  async function handleTransition(targetStatus: string, label: string) {
    setIsTransitioning(true);
    try {
      await api.patch(
        `/programs/${program._id}/requests/${request._id}/transition`,
        { status: targetStatus },
      );
      toast.success(`Request ${label.toLowerCase()}`);
      onRefresh?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message || `Failed to ${label.toLowerCase()} request`;
      toast.error(message);
    } finally {
      setIsTransitioning(false);
    }
  }
  const fieldDefinitions: FieldDefinition[] = program.fieldDefinitions || [];
  const sortedDefs = [...fieldDefinitions].sort((a, b) => a.order - b.order);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl">{request.title}</CardTitle>
            {request.description && (
              <p className="text-sm text-muted-foreground">{request.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              className={cn('capitalize', STATUS_VARIANT[request.status] || '')}
              variant="secondary"
            >
              {request.status.replace('_', ' ')}
            </Badge>
            <Badge
              variant={PRIORITY_VARIANT[request.priority] || 'default'}
              className={cn('capitalize', PRIORITY_EXTRA_CLASS[request.priority] || '')}
            >
              {request.priority}
            </Badge>
            {canSubmit && (
              <Button
                size="sm"
                onClick={() => handleTransition('todo', 'Submitted')}
                disabled={isTransitioning}
              >
                {isTransitioning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Submit
              </Button>
            )}
            {canStart && (
              <Button
                size="sm"
                onClick={() => handleTransition('in_progress', 'Started')}
                disabled={isTransitioning}
              >
                {isTransitioning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                Start
              </Button>
            )}
            {canComplete && (
              <Button
                size="sm"
                variant="default"
                onClick={() => handleTransition('completed', 'Completed')}
                disabled={isTransitioning}
              >
                {isTransitioning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Complete
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Program</span>
            <p className="font-medium">{program.name}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Created By</span>
            <p className="font-medium">{formatUserName(request.createdBy)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Assigned To</span>
            <div className="flex items-center gap-2">
              <p className="font-medium">{formatUserName(request.assignedTo, 'Unassigned')}</p>
              {canAssign && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onAssignClick}
                  title="Assign request"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Created At</span>
            <p className="font-medium">{formatDate(request.createdAt)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Last Updated</span>
            <p className="font-medium">{formatDate(request.updatedAt)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Due Date</span>
            {request.dueDate ? (
              <div className="flex items-center gap-2">
                <p className="font-medium">{formatDate(request.dueDate)}</p>
                {(() => {
                  const indicator = getDueDateIndicator(request.dueDate);
                  return (
                    <Badge
                      variant="secondary"
                      className={cn('text-[10px] px-1.5 py-0', indicator.className)}
                    >
                      {indicator.label}
                    </Badge>
                  );
                })()}
              </div>
            ) : (
              <p className="font-medium text-muted-foreground">-</p>
            )}
          </div>
        </div>

        {sortedDefs.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Custom Fields</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {sortedDefs.map((def) => (
                  <div key={def.key}>
                    <span className="text-muted-foreground">{def.label}</span>
                    {def.type === 'checklist' && Array.isArray(request.fields[def.key]) ? (
                      <div className="space-y-0.5 mt-1">
                        {(request.fields[def.key] as ChecklistItem[]).map((item, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs">
                            {item.checked ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Minus className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className={item.checked ? '' : 'text-muted-foreground'}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="font-medium">
                        {formatFieldValue(request.fields[def.key], def.type)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
