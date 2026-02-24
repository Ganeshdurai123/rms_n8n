import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import type { Program, PaginatedResponse } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export function ProgramListPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function fetchPrograms() {
      try {
        const { data } = await api.get<PaginatedResponse<Program>>(
          '/programs',
          { params: { limit: 50 } },
        );
        if (!cancelled) {
          setPrograms(data.data);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load programs. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPrograms();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div>
        <h2 className="mb-6 text-2xl font-bold tracking-tight">Programs</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="mt-2 h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="mb-6 text-2xl font-bold tracking-tight">Programs</h2>
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold tracking-tight">Programs</h2>

      {programs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            No programs found
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            You don&apos;t have access to any programs yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <Link
              key={program._id}
              to={`/programs/${program._id}/sheet`}
              className="group"
            >
              <Card className="transition-shadow group-hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{program.name}</CardTitle>
                      {program.complianceType && (
                        <Badge variant="outline" className="border-blue-400 text-blue-600 dark:text-blue-400 text-[10px] uppercase">
                          {program.complianceType}
                        </Badge>
                      )}
                    </div>
                    <Badge
                      variant={
                        program.status === 'active' ? 'default' : 'secondary'
                      }
                    >
                      {program.status}
                    </Badge>
                  </div>
                  {program.description && (
                    <CardDescription className="line-clamp-2">
                      {program.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {program.fieldDefinitions.length} field
                    {program.fieldDefinitions.length !== 1 ? 's' : ''} defined
                  </p>
                  {program.settings.maxActiveRequests !== undefined && program.settings.maxActiveRequests !== null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Max {program.settings.maxActiveRequests} active requests
                    </p>
                  )}
                  {program.settings.maxActiveRequestsPerUser !== undefined && program.settings.maxActiveRequestsPerUser !== null && (
                    <p className="text-xs text-muted-foreground">
                      Max {program.settings.maxActiveRequestsPerUser} per user
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
