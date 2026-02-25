import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import type { User, Role, PaginatedResponse, Program } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SheetPagination } from '@/components/sheet/SheetPagination';
import { toast } from 'sonner';
import {
  Plus,
  Loader2,
  Search,
  MoreHorizontal,
  UserPlus,
  Pencil,
  UserX,
  UserCheck,
  Link2,
} from 'lucide-react';

const ROLES: Role[] = ['admin', 'manager', 'team_member', 'client'];

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  admin: 'destructive',
  manager: 'default',
  team_member: 'secondary',
  client: 'outline',
};

function formatRole(role: string): string {
  return role.replace('_', ' ');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

// ---------- Create User Dialog ----------

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<Role>('team_member');
  const [saving, setSaving] = useState(false);

  function reset() {
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setRole('team_member');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users', { email, password, firstName, lastName, role });
      toast.success('User created successfully');
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : 'Failed to create user';
      toast.error(msg || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>
              Add a new user to the system and assign their role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cu-first">First Name</Label>
                <Input
                  id="cu-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cu-last">Last Name</Label>
                <Input
                  id="cu-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  maxLength={50}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cu-email">Email</Label>
              <Input
                id="cu-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cu-password">Password</Label>
              <Input
                id="cu-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                maxLength={128}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      <span className="capitalize">{formatRole(r)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Edit User Dialog ----------

function EditUserDialog({
  user,
  open,
  onOpenChange,
  onUpdated,
}: {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [email, setEmail] = useState(user.email);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [role, setRole] = useState<Role>(user.role);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmail(user.email);
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setRole(user.role);
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/users/' + user._id, { email, firstName, lastName, role });
      toast.success('User updated successfully');
      onOpenChange(false);
      onUpdated();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : 'Failed to update user';
      toast.error(msg || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details and role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eu-first">First Name</Label>
                <Input
                  id="eu-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eu-last">Last Name</Label>
                <Input
                  id="eu-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  maxLength={50}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eu-email">Email</Label>
              <Input
                id="eu-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      <span className="capitalize">{formatRole(r)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Assign to Program Dialog ----------

function AssignProgramDialog({
  user,
  open,
  onOpenChange,
  onAssigned,
}: {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [programRole, setProgramRole] = useState<string>('team_member');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function fetchPrograms() {
      setLoading(true);
      try {
        const { data } = await api.get<PaginatedResponse<Program>>(
          '/programs',
          { params: { limit: 100 } },
        );
        if (!cancelled) setPrograms(data.data);
      } catch {
        if (!cancelled) toast.error('Failed to load programs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPrograms();
    return () => { cancelled = true; };
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProgramId) return;
    setSaving(true);
    try {
      await api.post('/users/program-assignments', {
        userId: user._id,
        programId: selectedProgramId,
        role: programRole,
      });
      toast.success('User assigned to program');
      onOpenChange(false);
      onAssigned();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : 'Failed to assign user';
      toast.error(msg || 'Failed to assign user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Assign to Program</DialogTitle>
            <DialogDescription>
              Assign {user.firstName} {user.lastName} to a program with a
              specific role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Program</Label>
              {loading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select
                  value={selectedProgramId}
                  onValueChange={setSelectedProgramId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Program Role</Label>
              <Select value={programRole} onValueChange={setProgramRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">
                    <span className="capitalize">Manager</span>
                  </SelectItem>
                  <SelectItem value="team_member">
                    <span className="capitalize">Team Member</span>
                  </SelectItem>
                  <SelectItem value="client">
                    <span className="capitalize">Client</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !selectedProgramId}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Main Page ----------

export function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [assignUser, setAssignUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit };
      if (search) params.search = search;
      if (roleFilter !== 'all') params.role = roleFilter;
      const { data } = await api.get<PaginatedResponse<User>>('/users', {
        params,
      });
      setUsers(data.data);
      setTotal(data.pagination.total);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleToggleActive(user: User) {
    try {
      if (user.isActive) {
        await api.delete('/users/' + user._id);
        toast.success(user.firstName + ' deactivated');
      } else {
        await api.patch('/users/' + user._id, { isActive: true });
        toast.success(user.firstName + ' reactivated');
      }
      fetchUsers();
    } catch {
      toast.error('Failed to update user status');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            User Management
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} user{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(v) => {
            setRoleFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                <span className="capitalize">{formatRole(r)}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <UserPlus className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">
            {search || roleFilter !== 'all'
              ? 'No users match your filters'
              : 'No users yet'}
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u._id}>
                <TableCell className="font-medium">
                  {u.firstName} {u.lastName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {u.email}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={ROLE_VARIANT[u.role] || 'secondary'}
                    className="capitalize"
                  >
                    {formatRole(u.role)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.isActive ? (
                    <Badge
                      variant="outline"
                      className="border-green-400 text-green-600"
                    >
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-muted-foreground">
                      Inactive
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {u.createdAt ? formatDate(u.createdAt) : '-'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditUser(u)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAssignUser(u)}>
                        <Link2 className="mr-2 h-4 w-4" />
                        Assign to Program
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleToggleActive(u)}
                        className={
                          u.isActive ? 'text-destructive' : 'text-green-600'
                        }
                      >
                        {u.isActive ? (
                          <>
                            <UserX className="mr-2 h-4 w-4" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="mr-2 h-4 w-4" />
                            Reactivate
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {total > 0 && (
        <SheetPagination
          pagination={{ page, limit, total, pages: totalPages }}
          onPageChange={setPage}
          onLimitChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
        />
      )}

      {/* Dialogs */}
      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchUsers}
      />
      {editUser && (
        <EditUserDialog
          user={editUser}
          open={!!editUser}
          onOpenChange={(open) => { if (!open) setEditUser(null); }}
          onUpdated={fetchUsers}
        />
      )}
      {assignUser && (
        <AssignProgramDialog
          user={assignUser}
          open={!!assignUser}
          onOpenChange={(open) => { if (!open) setAssignUser(null); }}
          onAssigned={fetchUsers}
        />
      )}
    </div>
  );
}
