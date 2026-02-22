import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronUp, ChevronDown, Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RequestItem, FieldDefinition } from '@/lib/types';
import type { SheetQuery } from './useSheetData';

interface SheetTableProps {
  requests: RequestItem[];
  fieldDefinitions: FieldDefinition[];
  query: SheetQuery;
  onToggleSort: (column: string) => void;
  onRowClick?: (request: RequestItem) => void;
  isLoading: boolean;
  renderRowActions?: (request: RequestItem) => React.ReactNode;
}

const STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  in_review:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  approved:
    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  completed: 'bg-muted text-muted-foreground',
};

const PRIORITY_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  low: 'secondary',
  medium: 'default',
  high: 'outline',
  urgent: 'destructive',
};

const PRIORITY_EXTRA_CLASS: Record<string, string> = {
  high: 'border-orange-400 text-orange-600 dark:text-orange-400',
};

function formatUserName(
  user:
    | string
    | { _id: string; firstName: string; lastName: string; email?: string }
    | null
    | undefined,
  fallback = '-',
): string {
  if (!user) return fallback;
  if (typeof user === 'string') return user;
  return `${user.firstName} ${user.lastName}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function formatFieldValue(
  value: unknown,
  type: string,
): React.ReactNode {
  if (value === undefined || value === null) return '-';

  switch (type) {
    case 'text':
    case 'dropdown':
      return String(value);
    case 'number':
      return typeof value === 'number'
        ? value.toLocaleString()
        : String(value);
    case 'date':
      return formatDate(String(value));
    case 'checkbox':
      return value === true || value === 'true' ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Minus className="h-4 w-4 text-muted-foreground" />
      );
    case 'file_upload':
      return value ? (
        <span className="text-blue-600 underline">File</span>
      ) : (
        '-'
      );
    default:
      return String(value);
  }
}

function SortIndicator({
  column,
  query,
}: {
  column: string;
  query: SheetQuery;
}) {
  if (query.sortBy !== column) {
    return (
      <span className="ml-1 inline-flex opacity-0 group-hover:opacity-40">
        <ChevronUp className="h-3 w-3" />
      </span>
    );
  }
  return query.sortOrder === 'asc' ? (
    <ChevronUp className="ml-1 h-3 w-3 inline" />
  ) : (
    <ChevronDown className="ml-1 h-3 w-3 inline" />
  );
}

/** Fixed columns always shown. */
const FIXED_COLUMNS = [
  { key: 'title', label: 'Title', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'priority', label: 'Priority', sortable: true },
  { key: 'assignedTo', label: 'Assigned To', sortable: true },
  { key: 'createdBy', label: 'Created By', sortable: false },
  { key: 'createdAt', label: 'Created At', sortable: true },
];

/** Dynamic field types that are sortable. */
const SORTABLE_FIELD_TYPES = new Set(['text', 'number', 'date']);

export function SheetTable({
  requests,
  fieldDefinitions,
  query,
  onToggleSort,
  onRowClick,
  isLoading,
  renderRowActions,
}: SheetTableProps) {
  const sortedDefs = [...fieldDefinitions].sort(
    (a, b) => a.order - b.order,
  );

  const hasActions = !!renderRowActions;

  // Loading state: skeleton rows
  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {FIXED_COLUMNS.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
            {sortedDefs.map((def) => (
              <TableHead key={def.key}>{def.label}</TableHead>
            ))}
            {hasActions && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, rowIdx) => (
            <TableRow key={rowIdx}>
              {FIXED_COLUMNS.map((col) => (
                <TableCell key={col.key}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
              {sortedDefs.map((def) => (
                <TableCell key={def.key}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
              {hasActions && (
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  // Empty state
  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">No requests found</p>
        <p className="text-sm">
          Try adjusting your filters or search criteria.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {FIXED_COLUMNS.map((col) => (
            <TableHead
              key={col.key}
              className={cn(
                col.sortable &&
                  'cursor-pointer select-none group hover:text-foreground',
              )}
              onClick={
                col.sortable ? () => onToggleSort(col.key) : undefined
              }
            >
              {col.label}
              {col.sortable && (
                <SortIndicator column={col.key} query={query} />
              )}
            </TableHead>
          ))}
          {sortedDefs.map((def) => {
            const sortable = SORTABLE_FIELD_TYPES.has(def.type);
            return (
              <TableHead
                key={def.key}
                className={cn(
                  sortable &&
                    'cursor-pointer select-none group hover:text-foreground',
                )}
                onClick={
                  sortable ? () => onToggleSort(def.key) : undefined
                }
              >
                {def.label}
                {sortable && (
                  <SortIndicator column={def.key} query={query} />
                )}
              </TableHead>
            );
          })}
          {hasActions && <TableHead />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((req) => (
          <TableRow
            key={req._id}
            className={cn(onRowClick && 'cursor-pointer')}
            onClick={onRowClick ? () => onRowClick(req) : undefined}
          >
            {/* Title */}
            <TableCell className="font-medium max-w-[250px] truncate">
              {req.title}
            </TableCell>

            {/* Status */}
            <TableCell>
              <Badge
                className={cn(
                  'capitalize',
                  STATUS_VARIANT[req.status] || '',
                )}
                variant="secondary"
              >
                {req.status.replace('_', ' ')}
              </Badge>
            </TableCell>

            {/* Priority */}
            <TableCell>
              <Badge
                variant={PRIORITY_VARIANT[req.priority] || 'default'}
                className={cn(
                  'capitalize',
                  PRIORITY_EXTRA_CLASS[req.priority] || '',
                )}
              >
                {req.priority}
              </Badge>
            </TableCell>

            {/* Assigned To */}
            <TableCell>
              {formatUserName(
                req.assignedTo as
                  | string
                  | {
                      _id: string;
                      firstName: string;
                      lastName: string;
                    }
                  | null
                  | undefined,
                'Unassigned',
              )}
            </TableCell>

            {/* Created By */}
            <TableCell>
              {formatUserName(
                req.createdBy as
                  | string
                  | {
                      _id: string;
                      firstName: string;
                      lastName: string;
                    }
                  | null
                  | undefined,
              )}
            </TableCell>

            {/* Created At */}
            <TableCell>{formatDate(req.createdAt)}</TableCell>

            {/* Dynamic field columns */}
            {sortedDefs.map((def) => (
              <TableCell key={def.key}>
                {formatFieldValue(req.fields[def.key], def.type)}
              </TableCell>
            ))}

            {/* Actions column */}
            {hasActions && (
              <TableCell onClick={(e) => e.stopPropagation()}>
                {renderRowActions(req)}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
