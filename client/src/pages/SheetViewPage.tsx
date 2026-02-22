import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '@/lib/api';
import type { Program } from '@/lib/types';
import { useSheetData } from '@/components/sheet/useSheetData';
import { SheetTable } from '@/components/sheet/SheetTable';
import { SheetToolbar } from '@/components/sheet/SheetToolbar';
import { SheetPagination } from '@/components/sheet/SheetPagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface ProgramMember {
  _id: string;
  firstName: string;
  lastName: string;
}

export function SheetViewPage() {
  const { programId } = useParams<{ programId: string }>();
  const [program, setProgram] = useState<Program | null>(null);
  const [programLoading, setProgramLoading] = useState(true);
  const [programError, setProgramError] = useState<string | null>(null);
  const [members, setMembers] = useState<ProgramMember[]>([]);

  const {
    requests,
    pagination,
    query,
    isLoading,
    error,
    setPage,
    setLimit,
    setSort: _setSort,
    toggleSort,
    setFilter,
    setFieldFilter,
    setSearch,
    setDateRange,
    refresh,
  } = useSheetData(programId || '');

  // Fetch program config
  useEffect(() => {
    if (!programId) return;
    let cancelled = false;

    async function fetchProgram() {
      setProgramLoading(true);
      setProgramError(null);

      try {
        const { data } = await api.get(`/programs/${programId}`);
        if (!cancelled) {
          // API may return { data: program } or just program directly
          setProgram(data.data || data);
        }
      } catch (err) {
        if (!cancelled) {
          setProgramError(
            err instanceof Error
              ? err.message
              : 'Failed to load program',
          );
        }
      } finally {
        if (!cancelled) {
          setProgramLoading(false);
        }
      }
    }

    fetchProgram();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  // Fetch program members for assignee filter (graceful 404 handling)
  useEffect(() => {
    if (!programId) return;
    let cancelled = false;

    async function fetchMembers() {
      try {
        const { data } = await api.get(
          `/programs/${programId}/members`,
          { params: { limit: 100 } },
        );
        if (!cancelled) {
          // Members endpoint returns paginated response with .data array
          const memberList = data.data || data;
          // Each member has userId populated: { userId: { _id, firstName, lastName, ... } }
          const mapped: ProgramMember[] = (
            Array.isArray(memberList) ? memberList : []
          ).map((m: { userId?: { _id: string; firstName: string; lastName: string }; _id: string; firstName?: string; lastName?: string }) => {
            if (m.userId) {
              return {
                _id: m.userId._id,
                firstName: m.userId.firstName,
                lastName: m.userId.lastName,
              };
            }
            return {
              _id: m._id,
              firstName: m.firstName || '',
              lastName: m.lastName || '',
            };
          });
          setMembers(mapped);
        }
      } catch {
        // Gracefully handle 404 or auth errors -- leave assignee filter empty
        if (!cancelled) {
          setMembers([]);
        }
      }
    }

    fetchMembers();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  // Loading state for program config
  if (programLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="px-6 py-3">
          <div className="flex gap-3">
            <Skeleton className="h-9 w-[200px]" />
            <Skeleton className="h-9 w-[140px]" />
            <Skeleton className="h-9 w-[140px]" />
          </div>
        </div>
        <div className="flex-1 overflow-auto px-6">
          <div className="space-y-3 pt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state for program config
  if (programError || !program) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-destructive text-lg">
          {programError || 'Program not found'}
        </p>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">{program.name}</h1>
          <p className="text-muted-foreground">
            Sheet View - {pagination.total} requests
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3">
        <SheetToolbar
          query={query}
          onFilterChange={setFilter}
          onFieldFilterChange={setFieldFilter}
          onSearchChange={setSearch}
          onDateRangeChange={setDateRange}
          programMembers={members}
          fieldDefinitions={program.fieldDefinitions}
        />
      </div>

      {/* Error display for request fetch */}
      {error && (
        <div className="px-6 py-2">
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-2 rounded-md flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={refresh}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6">
        <SheetTable
          requests={requests}
          fieldDefinitions={program.fieldDefinitions}
          query={query}
          onToggleSort={toggleSort}
          isLoading={isLoading}
        />
      </div>

      {/* Pagination */}
      <div className="px-6 py-3 border-t">
        <SheetPagination
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </div>
    </div>
  );
}
