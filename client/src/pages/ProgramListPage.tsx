import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Program, PaginatedResponse } from '@/lib/types';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Loader2, CalendarClock, Calendar } from 'lucide-react';

export function ProgramListPage() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [dueDateEnabled, setDueDateEnabled] = useState(false);
  const [dueDateOffsetDays, setDueDateOffsetDays] = useState(7);

  const canCreate = user?.role === 'admin' || user?.role === 'manager';

  async function fetchPrograms() {
    try {
      const { data } = await api.get<PaginatedResponse<Program>>(
        '/programs',
        { params: { limit: 50 } },
      );
      setPrograms(data.data);
    } catch {
      setError('Failed to load programs. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPrograms();
  }, []);

  async function handleCreateProgram(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;

    setCreating(true);
    try {
      await api.post('/programs', {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        dueDateConfig: {
          enabled: dueDateEnabled,
          defaultOffsetDays: dueDateEnabled ? dueDateOffsetDays : 30,
        },
      });
      toast.success('Program created successfully');
      setDialogOpen(false);
      setFormName('');
      setFormDescription('');
      setDueDateEnabled(false);
      setDueDateOffsetDays(7);
      await fetchPrograms();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response
            ?.data?.message
          : 'Failed to create program';
      toast.error(msg || 'Failed to create program');
    } finally {
      setCreating(false);
    }
  }

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

  const createDialog = canCreate ? (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Program
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleCreateProgram}>
          <DialogHeader>
            <DialogTitle>Create Program</DialogTitle>
            <DialogDescription>
              Create a new program. You can add custom fields and configure
              settings after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="program-name">Name</Label>
              <Input
                id="program-name"
                placeholder="e.g. Q1 Compliance Review"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                minLength={2}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-desc">Description (optional)</Label>
              <Textarea
                id="program-desc"
                placeholder="Brief description of the program..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </div>

            {/* Due Date Configuration */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  <Label className="font-medium">Enable Due Dates</Label>
                </div>
                <input
                  type="checkbox"
                  id="due-date-enabled"
                  checked={dueDateEnabled}
                  onChange={(e) => setDueDateEnabled(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-primary"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                When enabled, each new request will automatically get a due date.
              </p>

              {dueDateEnabled && (
                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="due-date-offset" className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Default Days Until Due
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="due-date-offset"
                      type="number"
                      min={1}
                      max={365}
                      value={dueDateOffsetDays}
                      onChange={(e) => setDueDateOffsetDays(Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 1)))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">days after creation</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    e.g. if set to 7, a request created today will be due {new Date(Date.now() + dueDateOffsetDays * 24 * 60 * 60 * 1000).toLocaleDateString()}.
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={creating || !formName.trim()}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  ) : null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Programs</h2>
        {createDialog}
      </div>

      {programs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            No programs found
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canCreate
              ? 'Get started by creating your first program.'
              : "You don't have access to any programs yet."}
          </p>
          {canCreate && (
            <Button size="sm" className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Program
            </Button>
          )}
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
                    {program.requestCount ?? 0} request
                    {(program.requestCount ?? 0) !== 1 ? 's' : ''}
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
