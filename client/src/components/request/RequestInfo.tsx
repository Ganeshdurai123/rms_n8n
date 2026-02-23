import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { RequestDetail, FieldDefinition } from '@/lib/types';

const STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  in_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  completed: 'bg-muted text-muted-foreground',
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

function formatFieldValue(value: unknown, type: string): string {
  if (value === undefined || value === null) return '-';
  switch (type) {
    case 'checkbox':
      return value === true || value === 'true' ? 'Yes' : 'No';
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
}

export function RequestInfo({ detail }: RequestInfoProps) {
  const { request } = detail;
  const program = request.programId;
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
            <p className="font-medium">{formatUserName(request.assignedTo, 'Unassigned')}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Created At</span>
            <p className="font-medium">{formatDate(request.createdAt)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Last Updated</span>
            <p className="font-medium">{formatDate(request.updatedAt)}</p>
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
                    <p className="font-medium">
                      {formatFieldValue(request.fields[def.key], def.type)}
                    </p>
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
