import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
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
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComplianceReviewData {
  checklistFields: Array<{ key: string; label: string; items?: string[] }>;
  requests: Array<{
    requestId: string;
    title: string;
    status: string;
    completions: Record<string, { total: number; checked: number; percentage: number }>;
    overallPercentage: number;
  }>;
  summary: { totalRequests: number; averageCompletion: number };
}

function completionColor(percentage: number): string {
  if (percentage >= 80) return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900';
  if (percentage >= 50) return 'text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900';
  return 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900';
}

function completionTextColor(percentage: number): string {
  if (percentage >= 80) return 'text-green-700 dark:text-green-300';
  if (percentage >= 50) return 'text-orange-700 dark:text-orange-300';
  return 'text-red-700 dark:text-red-300';
}

export function ComplianceReviewPage() {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ComplianceReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(
          `/programs/${programId}/requests/compliance-review`,
        );
        if (!cancelled) {
          setData(response.data.data || response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load compliance review data',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-4 px-6 py-4 border-b">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="px-6 py-6 space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-4 px-6 py-4 border-b">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/programs/${programId}/sheet`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Compliance Review</h1>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data || data.checklistFields.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-4 px-6 py-4 border-b">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/programs/${programId}/sheet`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Compliance Review</h1>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 py-16 text-muted-foreground">
          <p className="text-lg font-medium">No checklist fields configured</p>
          <p className="text-sm">Add checklist fields to this program to see compliance data.</p>
        </div>
      </div>
    );
  }

  // Sort requests by overallPercentage ascending (lowest first)
  const sortedRequests = [...data.requests].sort(
    (a, b) => a.overallPercentage - b.overallPercentage,
  );

  // Compute per-field averages
  const fieldAverages: Record<string, number> = {};
  for (const field of data.checklistFields) {
    const percentages = data.requests
      .map((r) => r.completions[field.key]?.percentage ?? 0);
    fieldAverages[field.key] =
      percentages.length > 0
        ? Math.round(percentages.reduce((s, p) => s + p, 0) / percentages.length)
        : 0;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/programs/${programId}/sheet`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">Compliance Review</h1>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overall Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{data.summary.totalRequests}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Completion</p>
                <p className={cn('text-3xl font-bold', completionTextColor(data.summary.averageCompletion))}>
                  {data.summary.averageCompletion}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Checklist Fields Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Checklist Fields</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.checklistFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <p className="text-sm text-muted-foreground">{field.label}</p>
                  <p className={cn('text-lg font-semibold', completionTextColor(fieldAverages[field.key] ?? 0))}>
                    {fieldAverages[field.key] ?? 0}%
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Requests Table */}
        {sortedRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No requests found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                {data.checklistFields.map((field) => (
                  <TableHead key={field.key}>{field.label}</TableHead>
                ))}
                <TableHead>Overall</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRequests.map((req) => (
                <TableRow key={req.requestId}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {req.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize text-xs">
                      {req.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  {data.checklistFields.map((field) => {
                    const comp = req.completions[field.key];
                    if (!comp) return <TableCell key={field.key}>-</TableCell>;
                    return (
                      <TableCell key={field.key}>
                        <Badge
                          variant="secondary"
                          className={cn('text-xs', completionColor(comp.percentage))}
                        >
                          {comp.checked}/{comp.total} ({comp.percentage}%)
                        </Badge>
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn('text-xs font-semibold', completionColor(req.overallPercentage))}
                    >
                      {req.overallPercentage}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
