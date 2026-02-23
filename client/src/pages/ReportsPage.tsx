import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useSocket } from '@/lib/socket';
import type {
  ReportJob,
  ReportType,
  Program,
  PaginatedResponse,
} from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SheetPagination } from '@/components/sheet/SheetPagination';
import { toast } from 'sonner';
import { FileBarChart, Loader2 } from 'lucide-react';

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

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800 border-gray-200',
  processing: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
};

const TYPE_BADGE_CLASS: Record<string, string> = {
  summary: 'bg-purple-100 text-purple-800 border-purple-200',
  program: 'bg-blue-100 text-blue-800 border-blue-200',
  overdue: 'bg-orange-100 text-orange-800 border-orange-200',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportsPage() {
  const navigate = useNavigate();

  // Programs list for the program selector dropdown
  const [programs, setPrograms] = useState<Program[]>([]);

  // Generate form state
  const [summaryStart, setSummaryStart] = useState('');
  const [summaryEnd, setSummaryEnd] = useState('');
  const [programReportProgramId, setProgramReportProgramId] = useState('');
  const [programReportStart, setProgramReportStart] = useState('');
  const [programReportEnd, setProgramReportEnd] = useState('');
  const [overdueProgramId, setOverdueProgramId] = useState('');
  const [generatingType, setGeneratingType] = useState<ReportType | null>(null);

  // Report list state
  const [reports, setReports] = useState<ReportJob[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // Fetch programs (for dropdowns)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    api
      .get<PaginatedResponse<Program>>('/programs', { params: { limit: 100 } })
      .then(({ data }) => {
        if (!cancelled) setPrograms(data.data);
      })
      .catch(() => {
        // Silently fail -- programs dropdown will be empty
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch report list
  // ---------------------------------------------------------------------------
  const fetchReports = useCallback(async () => {
    setListLoading(true);
    try {
      const { data } = await api.get('/reports', {
        params: { page, limit },
      });
      setReports(data.data);
      setTotal(data.pagination.total);
    } catch {
      setReports([]);
      setTotal(0);
    } finally {
      setListLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // ---------------------------------------------------------------------------
  // Auto-refresh while any report is pending/processing
  // ---------------------------------------------------------------------------
  const reportsRef = useRef(reports);
  reportsRef.current = reports;

  useEffect(() => {
    const hasPending = reportsRef.current.some(
      (r) => r.status === 'pending' || r.status === 'processing',
    );
    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchReports();
    }, 10000);

    return () => clearInterval(interval);
  }, [reports, fetchReports]);

  // ---------------------------------------------------------------------------
  // Socket: listen for report:completed to refresh immediately
  // ---------------------------------------------------------------------------
  const socketEvents = useMemo(
    () => ({
      'report:completed': () => fetchReports(),
    }),
    [fetchReports],
  );

  useSocket(socketEvents);

  // ---------------------------------------------------------------------------
  // Generate report handler
  // ---------------------------------------------------------------------------
  async function handleGenerate(type: ReportType) {
    setGeneratingType(type);
    try {
      const body: Record<string, unknown> = { type };

      if (type === 'summary') {
        const params: Record<string, string> = {};
        if (summaryStart) params.startDate = summaryStart;
        if (summaryEnd) params.endDate = summaryEnd;
        if (Object.keys(params).length) body.params = params;
      } else if (type === 'program') {
        if (programReportProgramId) body.programId = programReportProgramId;
        const params: Record<string, string> = {};
        if (programReportStart) params.startDate = programReportStart;
        if (programReportEnd) params.endDate = programReportEnd;
        if (Object.keys(params).length) body.params = params;
      } else if (type === 'overdue') {
        if (overdueProgramId) body.programId = overdueProgramId;
      }

      await api.post('/reports', body);
      toast.success('Report generation started');
      fetchReports();
    } catch {
      toast.error('Failed to start report generation');
    } finally {
      setGeneratingType(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------
  const totalPages = Math.max(1, Math.ceil(total / limit));

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  function handleLimitChange(newLimit: number) {
    setLimit(newLimit);
    setPage(1);
  }

  // ---------------------------------------------------------------------------
  // Row click: navigate to detail for completed reports
  // ---------------------------------------------------------------------------
  function handleRowClick(report: ReportJob) {
    if (report.status === 'completed') {
      navigate(`/reports/${report._id}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Generate and view reports for request summaries, program analytics,
          and overdue tracking.
        </p>
      </div>

      {/* Generate Reports Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Summary Report Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary Report</CardTitle>
            <CardDescription>
              Request counts by status, program, and timeframe
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Start Date (optional)
              </label>
              <input
                type="date"
                value={summaryStart}
                onChange={(e) => setSummaryStart(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                End Date (optional)
              </label>
              <input
                type="date"
                value={summaryEnd}
                onChange={(e) => setSummaryEnd(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => handleGenerate('summary')}
              disabled={generatingType !== null}
            >
              {generatingType === 'summary' && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Generate
            </Button>
          </CardContent>
        </Card>

        {/* Program Report Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Program Report</CardTitle>
            <CardDescription>
              Field distributions and lifecycle metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Program</label>
              <Select
                value={programReportProgramId}
                onValueChange={setProgramReportProgramId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Start Date (optional)
              </label>
              <input
                type="date"
                value={programReportStart}
                onChange={(e) => setProgramReportStart(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                End Date (optional)
              </label>
              <input
                type="date"
                value={programReportEnd}
                onChange={(e) => setProgramReportEnd(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => handleGenerate('program')}
              disabled={generatingType !== null}
            >
              {generatingType === 'program' && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Generate
            </Button>
          </CardContent>
        </Card>

        {/* Overdue Report Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overdue Report</CardTitle>
            <CardDescription>
              All requests past their due date
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">
                Program Filter (optional)
              </label>
              <Select
                value={overdueProgramId}
                onValueChange={setOverdueProgramId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All programs" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => handleGenerate('overdue')}
              disabled={generatingType !== null}
            >
              {generatingType === 'overdue' && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Generate
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Report List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Generated Reports</h2>

        {listLoading && reports.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileBarChart className="h-12 w-12 mb-3" />
            <p className="text-lg font-medium">No reports generated yet</p>
            <p className="text-sm">
              Generate a report above to see results here.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow
                    key={report._id}
                    className={
                      report.status === 'completed'
                        ? 'cursor-pointer hover:bg-muted/50'
                        : ''
                    }
                    onClick={() => handleRowClick(report)}
                  >
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={TYPE_BADGE_CLASS[report.type] || ''}
                      >
                        {report.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_BADGE_CLASS[report.status] || ''}
                      >
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {relativeTime(report.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {report.completedAt
                        ? relativeTime(report.completedAt)
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {total > 0 && (
              <SheetPagination
                pagination={{ page, limit, total, pages: totalPages }}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
