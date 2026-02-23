import { FileSpreadsheet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ImportJob } from '@/lib/types';

interface ImportHistoryTableProps {
  imports: ImportJob[];
  isLoading: boolean;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function truncateFilename(name: string, maxLength = 40): string {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength) + '...';
}

function getPerformerName(
  performedBy: ImportJob['performedBy'],
): string {
  if (typeof performedBy === 'string') return 'Unknown';
  if (performedBy && performedBy.firstName) {
    return `${performedBy.firstName} ${performedBy.lastName}`;
  }
  return 'Unknown';
}

function StatusBadge({ status }: { status: ImportJob['status'] }) {
  const config: Record<
    ImportJob['status'],
    { label: string; className: string }
  > = {
    completed: {
      label: 'Completed',
      className: 'bg-green-100 text-green-800 border-green-200',
    },
    validated: {
      label: 'Validated',
      className: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    pending: {
      label: 'Pending',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-100 text-red-800 border-red-200',
    },
  };

  const { label, className } = config[status] || config.pending;

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[140px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
          <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function ImportHistoryTable({ imports, isLoading }: ImportHistoryTableProps) {
  if (!isLoading && imports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FileSpreadsheet className="h-12 w-12 mb-3" />
        <p className="text-lg font-medium">No imports yet</p>
        <p className="text-sm">Import history will appear here after your first import.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File Name</TableHead>
          <TableHead>Imported By</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Total Rows</TableHead>
          <TableHead className="text-right">Imported</TableHead>
          <TableHead className="text-right">Errors</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <SkeletonRows />
        ) : (
          imports.map((job) => (
            <TableRow key={job._id}>
              <TableCell
                className="font-medium max-w-[250px]"
                title={job.originalFilename}
              >
                {truncateFilename(job.originalFilename)}
              </TableCell>
              <TableCell>{getPerformerName(job.performedBy)}</TableCell>
              <TableCell>{formatDate(job.createdAt)}</TableCell>
              <TableCell className="text-right">{job.totalRows}</TableCell>
              <TableCell className="text-right text-green-600">
                {job.successCount}
              </TableCell>
              <TableCell
                className={`text-right ${job.errorCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`}
              >
                {job.errorCount}
              </TableCell>
              <TableCell>
                <StatusBadge status={job.status} />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
