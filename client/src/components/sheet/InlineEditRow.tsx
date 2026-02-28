import { useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { RequestItem, FieldDefinition, RequestPriority, ChecklistItem, RequestStatus, Role } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  in_review:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  approved:
    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  completed: 'bg-muted text-muted-foreground',
};

interface InlineEditRowProps {
  request: RequestItem;
  programId: string;
  fieldDefinitions: FieldDefinition[];
  onSaved: () => void;
  onCancel: () => void;
  userRole: Role;
  userId: string;
}

export function InlineEditRow({
  request,
  programId,
  fieldDefinitions,
  onSaved,
  onCancel,
  userRole,
  userId,
}: InlineEditRowProps) {
  const [title, setTitle] = useState(request.title);
  const [status, setStatus] = useState<RequestStatus>(request.status);
  const [priority, setPriority] = useState<RequestPriority>(request.priority);
  const [fields, setFields] = useState<Record<string, unknown>>({
    ...request.fields,
  });
  const [titleError, setTitleError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedDefs = [...fieldDefinitions].sort((a, b) => a.order - b.order);

  function updateField(key: string, value: unknown) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function getCreatorId(createdBy: RequestItem['createdBy']): string {
    if (!createdBy) return '';
    if (typeof createdBy === 'string') return createdBy;
    return createdBy._id;
  }

  function formatUserName(
    user:
      | string
      | { _id: string; firstName: string; lastName: string }
      | null
      | undefined,
    fallback = '-',
  ): string {
    if (!user) return fallback;
    if (typeof user === 'string') return user;
    return `${user.firstName} ${user.lastName}`;
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  }

  async function handleSave() {
    // Validate title
    if (!title || title.trim().length < 3) {
      setTitleError('Title must be at least 3 characters');
      return;
    }
    setTitleError(null);

    // Compute diff against original
    const changes: Record<string, unknown> = {};

    if (title.trim() !== request.title) {
      changes.title = title.trim();
    }
    if (priority !== request.priority) {
      changes.priority = priority;
    }

    // Diff dynamic fields
    const fieldChanges: Record<string, unknown> = {};
    let hasFieldChanges = false;
    for (const def of fieldDefinitions) {
      const originalVal = request.fields[def.key];
      const currentVal = fields[def.key];
      // Compare as strings for simplicity (handles type coercion)
      if (String(currentVal ?? '') !== String(originalVal ?? '')) {
        fieldChanges[def.key] = currentVal;
        hasFieldChanges = true;
      }
    }
    if (hasFieldChanges) {
      changes.fields = fieldChanges;
    }

    // If nothing changed, just cancel
    if (Object.keys(changes).length === 0 && status === request.status) {
      onCancel();
      return;
    }

    setIsSubmitting(true);
    try {
      if (Object.keys(changes).length > 0) {
        await api.patch(
          `/programs/${programId}/requests/${request._id}`,
          changes,
        );
      }
      if (status !== request.status) {
        await api.patch(
          `/programs/${programId}/requests/${request._id}/transition`,
          { status }
        );
      }
      toast.success('Request updated');
      onSaved();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || 'Failed to update request';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderFieldInput(def: FieldDefinition) {
    if (def.type === 'file_upload') {
      return <span className="text-muted-foreground text-xs">-</span>;
    }

    const currentValue = fields[def.key];

    switch (def.type) {
      case 'text':
        return (
          <Input
            type="text"
            placeholder={def.placeholder || def.label}
            value={(currentValue as string) || ''}
            onChange={(e) => updateField(def.key, e.target.value)}
            className="h-8 text-sm"
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            placeholder={def.placeholder || def.label}
            value={currentValue !== undefined && currentValue !== null ? String(currentValue) : ''}
            onChange={(e) =>
              updateField(
                def.key,
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
            className="h-8 text-sm"
          />
        );
      case 'date':
        return (
          <Input
            type="date"
            value={(currentValue as string) || ''}
            onChange={(e) => updateField(def.key, e.target.value || undefined)}
            className="h-8 text-sm"
          />
        );
      case 'dropdown':
        return (
          <Select
            value={(currentValue as string) || '__none__'}
            onValueChange={(val) =>
              updateField(def.key, val === '__none__' ? undefined : val)
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={def.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">-</SelectItem>
              {(def.options || []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={
              currentValue === true || currentValue === 'true'
            }
            onChange={(e) => updateField(def.key, e.target.checked)}
            className="h-4 w-4"
          />
        );
      case 'checklist':
        return (
          <div className="space-y-1 max-h-[120px] overflow-auto">
            {(def.items || []).map((item) => {
              const currentArr = (currentValue as ChecklistItem[] | undefined) || [];
              const itemState = currentArr.find(ci => ci.label === item);
              const isChecked = itemState?.checked ?? false;
              return (
                <label key={item} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={isChecked}
                    onChange={(e) => {
                      const existing = (currentValue as ChecklistItem[] | undefined) ||
                        (def.items || []).map(i => ({ label: i, checked: false }));
                      const updated = existing.map(ci =>
                        ci.label === item ? { ...ci, checked: e.target.checked } : ci
                      );
                      updateField(def.key, updated);
                    }}
                  />
                  <span className="truncate">{item}</span>
                </label>
              );
            })}
          </div>
        );
      default:
        return <span className="text-muted-foreground text-xs">-</span>;
    }
  }

  return (
    <TableRow className="bg-blue-50/50 dark:bg-blue-950/20">
      {/* Title */}
      <TableCell>
        <div>
          <Input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError(null);
            }}
            className={`h-8 text-sm ${titleError ? 'border-destructive' : ''}`}
          />
          {titleError && (
            <p className="text-destructive text-xs mt-0.5">{titleError}</p>
          )}
        </div>
      </TableCell>

      {/* Status */}
      <TableCell>
        <Select
          value={status}
          onValueChange={(val) => setStatus(val as RequestStatus)}
        >
          <SelectTrigger className={cn('h-8 text-sm w-[120px] capitalize', STATUS_VARIANT[status] || '')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={request.status}>
              <span className="capitalize">{request.status.replace('_', ' ')}</span>
            </SelectItem>
            {(request.status === 'draft' || request.status === 'rejected') && (getCreatorId(request.createdBy) === userId || userRole === 'admin' || userRole === 'manager') && (
              <SelectItem value="submitted">Submitted</SelectItem>
            )}
            {/* Other transitions could go here, but inline row is mostly used for Drafts */}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Priority */}
      <TableCell>
        <Select
          value={priority}
          onValueChange={(val) => setPriority(val as RequestPriority)}
        >
          <SelectTrigger className="h-8 text-sm w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>

      {/* Assigned To - disabled */}
      <TableCell>
        <span className="text-sm">
          {formatUserName(
            request.assignedTo as
            | string
            | { _id: string; firstName: string; lastName: string }
            | null
            | undefined,
            'Unassigned',
          )}
        </span>
      </TableCell>

      {/* Created By - disabled */}
      <TableCell>
        <span className="text-sm">
          {formatUserName(
            request.createdBy as
            | string
            | { _id: string; firstName: string; lastName: string }
            | null
            | undefined,
          )}
        </span>
      </TableCell>

      {/* Created At - disabled */}
      <TableCell>
        <span className="text-sm">{formatDate(request.createdAt)}</span>
      </TableCell>

      {/* Dynamic fields */}
      {sortedDefs.map((def) => (
        <TableCell key={def.key}>{renderFieldInput(def)}</TableCell>
      ))}

      {/* Actions: Save / Cancel */}
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleSave}
            disabled={isSubmitting}
            title="Save"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4 text-green-600" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCancel}
            disabled={isSubmitting}
            title="Cancel"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
