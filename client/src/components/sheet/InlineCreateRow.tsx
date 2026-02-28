import { useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import type { FieldDefinition, RequestPriority, ChecklistItem } from '@/lib/types';

interface InlineCreateRowProps {
  programId: string;
  fieldDefinitions: FieldDefinition[];
  hasDueDate?: boolean;
  hasChain?: boolean;
  onCreated: () => void;
  onCancel: () => void;
}

export function InlineCreateRow({
  programId,
  fieldDefinitions,
  hasDueDate,
  hasChain,
  onCreated,
  onCancel,
}: InlineCreateRowProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<RequestPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [titleError, setTitleError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedDefs = [...fieldDefinitions].sort((a, b) => a.order - b.order);

  function updateField(key: string, value: unknown) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    // Validate title
    if (!title || title.trim().length < 3) {
      setTitleError('Title must be at least 3 characters');
      return;
    }
    setTitleError(null);

    setIsSubmitting(true);
    try {
      // Build the fields record (only include non-empty values)
      const cleanFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined && value !== '' && value !== null) {
          cleanFields[key] = value;
        }
      }

      await api.post(`/programs/${programId}/requests`, {
        title: title.trim(),
        description: '',
        priority,
        dueDate: dueDate || undefined,
        fields: Object.keys(cleanFields).length > 0 ? cleanFields : undefined,
        programId,
      });

      toast.success('Request created');
      onCreated();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message || 'Failed to create request';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderFieldInput(def: FieldDefinition) {
    if (def.type === 'file_upload') {
      return <span className="text-muted-foreground text-xs">-</span>;
    }

    switch (def.type) {
      case 'text':
        return (
          <Input
            type="text"
            placeholder={def.placeholder || def.label}
            value={(fields[def.key] as string) || ''}
            onChange={(e) => updateField(def.key, e.target.value)}
            className="h-8 text-sm"
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            placeholder={def.placeholder || def.label}
            value={fields[def.key] !== undefined ? String(fields[def.key]) : ''}
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
            value={(fields[def.key] as string) || ''}
            onChange={(e) => updateField(def.key, e.target.value || undefined)}
            className="h-8 text-sm"
          />
        );
      case 'dropdown':
        return (
          <Select
            value={(fields[def.key] as string) || '__none__'}
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
            checked={!!fields[def.key]}
            onChange={(e) => updateField(def.key, e.target.checked)}
            className="h-4 w-4"
          />
        );
      case 'checklist':
        return (
          <div className="space-y-1 max-h-[120px] overflow-auto">
            {(def.items || []).map((item) => {
              const currentVal = (fields[def.key] as ChecklistItem[] | undefined) || [];
              const itemState = currentVal.find(ci => ci.label === item);
              const isChecked = itemState?.checked ?? false;
              return (
                <label key={item} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={isChecked}
                    onChange={(e) => {
                      const existing = (fields[def.key] as ChecklistItem[] | undefined) ||
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
    <TableRow className="bg-muted/30">
      {/* Title */}
      <TableCell>
        <div>
          <Input
            type="text"
            placeholder="Request title (required)"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError(null);
            }}
            className={`h-8 text-sm ${titleError ? 'border-destructive' : ''}`}
            autoFocus
          />
          {titleError && (
            <p className="text-destructive text-xs mt-0.5">{titleError}</p>
          )}
        </div>
      </TableCell>

      {/* Status - always draft */}
      <TableCell>
        <Badge variant="secondary" className="capitalize">
          draft
        </Badge>
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

      {/* Assigned To - empty */}
      <TableCell>
        <span className="text-muted-foreground text-sm">-</span>
      </TableCell>

      {/* Created By - auto */}
      <TableCell>
        <span className="text-muted-foreground text-sm">-</span>
      </TableCell>

      {/* Created At - auto */}
      <TableCell>
        <span className="text-muted-foreground text-sm">-</span>
      </TableCell>

      {/* Due Date */}
      {hasDueDate && (
        <TableCell>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-8 text-sm"
          />
        </TableCell>
      )}

      {/* Chain - placeholder */}
      {hasChain && (
        <TableCell>
          <span className="text-muted-foreground text-sm">-</span>
        </TableCell>
      )}

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
