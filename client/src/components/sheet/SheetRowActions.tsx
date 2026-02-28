import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  UserPlus,
  Send,
  Play,
  CheckCircle2,
} from 'lucide-react';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { RequestItem, Role } from '@/lib/types';

interface SheetRowActionsProps {
  request: RequestItem;
  programId: string;
  onEdit: () => void;
  onDeleted: () => void;
  onAssign?: () => void;
  onRefresh: () => void;
  userRole: Role;
  userId: string;
}

function getCreatorId(
  createdBy: RequestItem['createdBy'],
): string {
  if (!createdBy) return '';
  if (typeof createdBy === 'string') return createdBy;
  return createdBy._id;
}

export function SheetRowActions({
  request,
  programId,
  onEdit,
  onDeleted,
  onAssign,
  onRefresh,
  userRole,
  userId,
}: SheetRowActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const isDraft = request.status === 'draft';
  const isCreator = getCreatorId(request.createdBy) === userId;
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager';
  const isTeamMember = userRole === 'team_member';

  const canEdit = isDraft;
  const canDelete = isDraft && (isCreator || isAdmin);
  const canAssign = (isAdmin || isManager) && request.status !== 'completed';

  // Status transition permissions
  const canSubmit = isDraft && isCreator;
  const canStart = request.status === 'todo' && (isAdmin || isManager || isTeamMember);
  const canComplete = request.status === 'in_progress' && (isAdmin || isManager || isTeamMember);

  const hasAnyAction = canEdit || canDelete || canAssign || canSubmit || canStart || canComplete;

  // If no actions available, render nothing
  if (!hasAnyAction) {
    return null;
  }

  async function handleTransition(targetStatus: string, label: string) {
    setIsTransitioning(true);
    try {
      await api.patch(
        `/programs/${programId}/requests/${request._id}/transition`,
        { status: targetStatus },
      );
      toast.success(`Request ${label.toLowerCase()}`);
      onRefresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message || `Failed to ${label.toLowerCase()} request`;
      toast.error(message);
    } finally {
      setIsTransitioning(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await api.delete(`/programs/${programId}/requests/${request._id}`);
      toast.success('Request deleted');
      setShowDeleteDialog(false);
      onDeleted();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message || 'Failed to delete request';
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Status transition actions */}
          {canSubmit && (
            <DropdownMenuItem
              onClick={() => handleTransition('todo', 'Submitted')}
              disabled={isTransitioning}
            >
              <Send className="h-4 w-4 mr-2" />
              Submit
            </DropdownMenuItem>
          )}
          {canStart && (
            <DropdownMenuItem
              onClick={() => handleTransition('in_progress', 'Started')}
              disabled={isTransitioning}
            >
              <Play className="h-4 w-4 mr-2" />
              Start
            </DropdownMenuItem>
          )}
          {canComplete && (
            <DropdownMenuItem
              onClick={() => handleTransition('completed', 'Completed')}
              disabled={isTransitioning}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Complete
            </DropdownMenuItem>
          )}
          {(canSubmit || canStart || canComplete) && (canAssign || canEdit || canDelete) && (
            <DropdownMenuSeparator />
          )}
          {canAssign && (
            <DropdownMenuItem onClick={onAssign}>
              <UserPlus className="h-4 w-4 mr-2" />
              Assign
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &apos;{request.title}&apos;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
