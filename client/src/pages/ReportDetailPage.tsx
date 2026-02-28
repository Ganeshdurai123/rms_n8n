import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useSocket } from '@/lib/socket';
import type {
  ReportJob,
  SummaryReportResult,
  ProgramReportResult,
  OverdueReportResult,
} from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getRequestedByName(
  requestedBy: ReportJob['requestedBy'],
): string {
  if (typeof requestedBy === 'string') return 'Unknown';
  return `${requestedBy.firstName} ${requestedBy.lastName}`;
}

function getProgramName(
  programId: ReportJob['programId'],
): string {
  if (!programId) return '';
  if (typeof programId === 'string') return programId;
  return programId.name;
}

const TYPE_BADGE_CLASS: Record<string, string> = {
  summary: 'bg-purple-100 text-purple-800 border-purple-200',
  program: 'bg-blue-100 text-blue-800 border-blue-200',
  overdue: 'bg-orange-100 text-orange-800 border-orange-200',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-400',
  todo: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  completed: 'bg-emerald-600',
};

// ---------------------------------------------------------------------------
// Bar chart component (Tailwind div-based, no chart library)
// ---------------------------------------------------------------------------

interface BarChartItem {
  label: string;
  count: number;
  colorClass?: string;
}

function HorizontalBarChart({
  items,
  defaultColor = 'bg-blue-500',
}: {
  items: BarChartItem[];
  defaultColor?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">No data available</p>
    );
  }

  const maxCount = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const widthPercent = Math.max((item.count / maxCount) * 100, 2);
        return (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-sm w-32 truncate text-right text-muted-foreground">
              {item.label}
            </span>
            <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
              <div
                className={cn(
                  'h-full rounded transition-all',
                  item.colorClass || defaultColor,
                )}
                style={{ width: `${widthPercent}%` }}
              />
            </div>
            <span className="text-sm font-medium w-10 text-right">
              {item.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Report View
// ---------------------------------------------------------------------------

function SummaryReportView({ result, params }: { result: SummaryReportResult; params?: ReportJob['params'] }) {
  const totalRequests = result.byStatus.reduce((s, item) => s + item.count, 0);

  const statusItems: BarChartItem[] = result.byStatus.map((s) => ({
    label: s.status.replace('_', ' '),
    count: s.count,
    colorClass: STATUS_COLORS[s.status] || 'bg-blue-500',
  }));

  const programItems: BarChartItem[] = result.byProgram.map((p) => ({
    label: p.programName,
    count: p.count,
  }));

  const dateRangeText =
    params?.startDate || params?.endDate
      ? `${params.startDate ? formatDate(params.startDate) : 'All time'} - ${params.endDate ? formatDate(params.endDate) : 'Present'}`
      : '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Request Summary</h2>
        {dateRangeText && (
          <p className="text-sm text-muted-foreground">{dateRangeText}</p>
        )}
        <p className="text-3xl font-bold mt-2">{totalRequests}</p>
        <p className="text-sm text-muted-foreground">Total requests</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* By Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Status</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart items={statusItems} />
          </CardContent>
        </Card>

        {/* By Program */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Program</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart items={programItems} defaultColor="bg-blue-500" />
          </CardContent>
        </Card>

        {/* By Month */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Month</CardTitle>
          </CardHeader>
          <CardContent>
            {result.byMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No monthly data
              </p>
            ) : (
              <div className="space-y-2">
                {result.byMonth.map((m) => {
                  // Format month: "2026-01" -> "Jan 2026"
                  let monthLabel = m.month;
                  try {
                    const [year, month] = m.month.split('-');
                    const date = new Date(Number(year), Number(month) - 1, 1);
                    monthLabel = date.toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    });
                  } catch {
                    // keep original
                  }
                  return (
                    <div
                      key={m.month}
                      className="flex items-center justify-between py-1 border-b border-border last:border-0"
                    >
                      <span className="text-sm text-muted-foreground">
                        {monthLabel}
                      </span>
                      <span className="text-sm font-medium">{m.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Program Report View
// ---------------------------------------------------------------------------

function ProgramReportView({ result, programName }: { result: ProgramReportResult; programName: string }) {
  const statusItems: BarChartItem[] = result.statusBreakdown.map((s) => ({
    label: s.status.replace('_', ' '),
    count: s.count,
    colorClass: STATUS_COLORS[s.status] || 'bg-blue-500',
  }));

  return (
    <div className="space-y-6">
      {programName && (
        <h2 className="text-lg font-semibold">{programName}</h2>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart items={statusItems} />
          </CardContent>
        </Card>

        {/* Average Lifecycle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Average Lifecycle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-4">
              <span className="text-4xl font-bold">
                {result.avgLifecycleDays !== null
                  ? `${result.avgLifecycleDays.toFixed(1)}`
                  : 'N/A'}
              </span>
              <span className="text-sm text-muted-foreground mt-1">
                {result.avgLifecycleDays !== null
                  ? 'days average from creation to completion'
                  : 'No completed requests to calculate'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Field Value Distributions */}
      {result.fieldDistributions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold">Field Value Distributions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.fieldDistributions.map((field) => {
              const fieldItems: BarChartItem[] = field.values.map((v) => ({
                label: v.value || '(empty)',
                count: v.count,
              }));

              return (
                <Card key={field.fieldKey}>
                  <CardHeader>
                    <CardTitle className="text-sm">{field.fieldLabel}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {fieldItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No data for this field
                      </p>
                    ) : (
                      <HorizontalBarChart
                        items={fieldItems}
                        defaultColor="bg-indigo-500"
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overdue Report View
// ---------------------------------------------------------------------------

function OverdueReportView({ result }: { result: OverdueReportResult }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Overdue Requests</h2>
        <p className="text-3xl font-bold mt-1">{result.totalOverdue}</p>
        <p className="text-sm text-muted-foreground">Total overdue</p>
      </div>

      {result.overdueRequests.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No overdue requests found.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Days Overdue</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Created By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.overdueRequests.map((req) => (
              <TableRow key={req.requestId}>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {req.title}
                </TableCell>
                <TableCell className="text-sm">{req.programName}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize text-xs">
                    {req.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(req.dueDate)}
                </TableCell>
                <TableCell className="text-right font-semibold text-red-600">
                  {req.daysOverdue}
                </TableCell>
                <TableCell className="text-sm">
                  {req.assignedTo ? req.assignedTo.name : '-'}
                </TableCell>
                <TableCell className="text-sm">
                  {req.createdBy.name}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<ReportJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch report
  // ---------------------------------------------------------------------------
  const fetchReport = useCallback(async () => {
    if (!reportId) return;
    try {
      const { data } = await api.get(`/reports/${reportId}`);
      setReport(data.data || data);
      setError(null);
    } catch {
      setError('Report not found');
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // ---------------------------------------------------------------------------
  // Auto-refresh for pending/processing reports
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!report || (report.status !== 'pending' && report.status !== 'processing')) {
      return;
    }

    const interval = setInterval(() => {
      fetchReport();
    }, 5000);

    return () => clearInterval(interval);
  }, [report, fetchReport]);

  // ---------------------------------------------------------------------------
  // Socket: listen for report:completed
  // ---------------------------------------------------------------------------
  const socketEvents = useMemo(
    () => ({
      'report:completed': () => fetchReport(),
    }),
    [fetchReport],
  );

  useSocket(socketEvents);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (error || !report) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/reports')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Reports
        </Button>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-lg font-medium text-destructive">
            {error || 'Report not found'}
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/reports')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Report Detail</h1>
              <Badge
                variant="outline"
                className={TYPE_BADGE_CLASS[report.type] || ''}
              >
                {report.type}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span>Generated {relativeTime(report.createdAt)}</span>
              {report.completedAt && (
                <>
                  <span>-</span>
                  <span>Completed {relativeTime(report.completedAt)}</span>
                </>
              )}
              <span>-</span>
              <span>By {getRequestedByName(report.requestedBy)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pending/Processing state */}
      {(report.status === 'pending' || report.status === 'processing') && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-lg font-medium">
              Report is being generated...
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              This page will update automatically when the report is ready.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Failed state */}
      {report.status === 'failed' && (
        <Card className="border-red-200">
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-lg font-medium text-red-600">
                Report Generation Failed
              </p>
              <p className="text-sm text-red-500 mt-2">
                {report.error || 'An unknown error occurred during report generation.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed state: type-specific views */}
      {report.status === 'completed' && report.result && (
        <>
          {report.type === 'summary' && (
            <SummaryReportView
              result={report.result as SummaryReportResult}
              params={report.params}
            />
          )}

          {report.type === 'program' && (
            <ProgramReportView
              result={report.result as ProgramReportResult}
              programName={getProgramName(report.programId)}
            />
          )}

          {report.type === 'overdue' && (
            <OverdueReportView
              result={report.result as OverdueReportResult}
            />
          )}
        </>
      )}
    </div>
  );
}
