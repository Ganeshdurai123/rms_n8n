import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload } from 'lucide-react';
import api from '@/lib/api';
import type { ImportJob, Program } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ImportHistoryTable } from '@/components/import/ImportHistoryTable';
import { SheetPagination } from '@/components/sheet/SheetPagination';

export function ImportHistoryPage() {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();

  const [imports, setImports] = useState<ImportJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [programName, setProgramName] = useState('');

  // Fetch program name on mount
  useEffect(() => {
    if (!programId) return;
    let cancelled = false;

    api.get<Program>(`/programs/${programId}`).then(({ data }) => {
      if (!cancelled) {
        setProgramName(data.name);
      }
    }).catch(() => {
      // Silently ignore -- program name is optional display
    });

    return () => { cancelled = true; };
  }, [programId]);

  // Fetch import history on mount and when page/limit changes
  useEffect(() => {
    if (!programId) return;
    let cancelled = false;

    setIsLoading(true);
    api
      .get(`/programs/${programId}/requests/import/history`, {
        params: { page, limit },
      })
      .then(({ data }) => {
        if (!cancelled) {
          setImports(data.data);
          setTotal(data.pagination.total);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImports([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [programId, page, limit]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  function handleLimitChange(newLimit: number) {
    setLimit(newLimit);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Import History</h1>
          {programName && (
            <p className="text-muted-foreground">{programName}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/programs/${programId}/sheet`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Sheet
          </Button>
          <Button
            onClick={() => navigate(`/programs/${programId}/import`)}
          >
            <Upload className="h-4 w-4 mr-1" />
            New Import
          </Button>
        </div>
      </div>

      {/* Import History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Past Imports</CardTitle>
          <CardDescription>
            View all import jobs for this program with their status and results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportHistoryTable imports={imports} isLoading={isLoading} />
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 0 && (
        <SheetPagination
          pagination={{ page, limit, total, pages: totalPages }}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      )}
    </div>
  );
}
