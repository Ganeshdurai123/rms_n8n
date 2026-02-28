import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Download, Upload, History } from 'lucide-react';
import type { FieldDefinition, Role } from '@/lib/types';
import type { SheetQuery } from './useSheetData';

interface SheetToolbarProps {
  query: SheetQuery;
  onFilterChange: (key: string, value: string | undefined) => void;
  onFieldFilterChange: (fieldKey: string, value: string | undefined) => void;
  onSearchChange: (search: string) => void;
  onDateRangeChange: (after?: string, before?: string) => void;
  onExport?: () => void;
  programMembers?: { _id: string; firstName: string; lastName: string }[];
  fieldDefinitions?: FieldDefinition[];
  programId?: string;
  userRole?: Role;
}

const STATUS_OPTIONS = [
  { value: '__all__', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const PRIORITY_OPTIONS = [
  { value: '__all__', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function SheetToolbar({
  query,
  onFilterChange,
  onFieldFilterChange,
  onSearchChange,
  onDateRangeChange,
  onExport,
  programMembers,
  fieldDefinitions,
  programId,
  userRole,
}: SheetToolbarProps) {
  const navigate = useNavigate();
  const canImport = userRole === 'admin' || userRole === 'manager';

  const hasActiveFilters =
    query.status ||
    query.priority ||
    query.assignedTo ||
    query.search ||
    query.createdAfter ||
    query.createdBefore ||
    (query.fields && Object.keys(query.fields).length > 0);

  function handleClearFilters() {
    onFilterChange('status', undefined);
    onFilterChange('priority', undefined);
    onFilterChange('assignedTo', undefined);
    onSearchChange('');
    onDateRangeChange(undefined, undefined);
    // Clear all custom field filters
    if (query.fields) {
      for (const key of Object.keys(query.fields)) {
        onFieldFilterChange(key, undefined);
      }
    }
  }

  // Filterable custom field definitions (dropdown + checkbox only)
  const filterableDefs = (fieldDefinitions || []).filter(
    (def) => def.type === 'dropdown' || def.type === 'checkbox',
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search requests..."
          value={query.search || ''}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 w-[200px]"
        />
      </div>

      {/* Status filter */}
      <Select
        value={query.status || '__all__'}
        onValueChange={(val) =>
          onFilterChange('status', val === '__all__' ? undefined : val)
        }
      >
        <SelectTrigger className="h-9 w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Priority filter */}
      <Select
        value={query.priority || '__all__'}
        onValueChange={(val) =>
          onFilterChange('priority', val === '__all__' ? undefined : val)
        }
      >
        <SelectTrigger className="h-9 w-[140px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Assignee filter (hidden for client role -- clients see only their own requests) */}
      {userRole !== 'client' && programMembers && programMembers.length > 0 && (
        <Select
          value={query.assignedTo || '__all__'}
          onValueChange={(val) =>
            onFilterChange('assignedTo', val === '__all__' ? undefined : val)
          }
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Assignees</SelectItem>
            {programMembers.map((member) => (
              <SelectItem key={member._id} value={member._id}>
                {member.firstName} {member.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Date range inputs */}
      <div className="flex items-center gap-1">
        <Input
          type="date"
          value={query.createdAfter || ''}
          onChange={(e) =>
            onDateRangeChange(e.target.value || undefined, query.createdBefore)
          }
          className="h-9 w-[140px]"
          title="From date"
          placeholder="From"
        />
        <span className="text-muted-foreground text-sm">-</span>
        <Input
          type="date"
          value={query.createdBefore || ''}
          onChange={(e) =>
            onDateRangeChange(query.createdAfter, e.target.value || undefined)
          }
          className="h-9 w-[140px]"
          title="To date"
          placeholder="To"
        />
      </div>

      {/* Custom field filters (SHEET-04): dropdown and checkbox fields only */}
      {filterableDefs.map((def) => {
        if (def.type === 'dropdown' && def.options) {
          return (
            <Select
              key={def.key}
              value={query.fields?.[def.key] || '__all__'}
              onValueChange={(val) =>
                onFieldFilterChange(
                  def.key,
                  val === '__all__' ? undefined : val,
                )
              }
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder={def.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All {def.label}</SelectItem>
                {def.options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }

        if (def.type === 'checkbox') {
          return (
            <Select
              key={def.key}
              value={query.fields?.[def.key] || '__all__'}
              onValueChange={(val) =>
                onFieldFilterChange(
                  def.key,
                  val === '__all__' ? undefined : val,
                )
              }
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder={def.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All {def.label}</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          );
        }

        return null;
      })}

      {/* Clear filters button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="h-9"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}

      {/* Import button (admin/manager only) */}
      {canImport && programId && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/programs/${programId}/import`)}
          className="h-9"
        >
          <Upload className="h-4 w-4 mr-1" />
          Import
        </Button>
      )}

      {/* Import History button (admin/manager only) */}
      {canImport && programId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/programs/${programId}/import/history`)}
          className="h-9"
        >
          <History className="h-4 w-4 mr-1" />
          Import History
        </Button>
      )}

      {/* Export button slot */}
      {onExport && (
        <Button variant="outline" size="sm" onClick={onExport} className="h-9">
          <Download className="h-4 w-4 mr-1" />
          Export CSV
        </Button>
      )}
    </div>
  );
}
