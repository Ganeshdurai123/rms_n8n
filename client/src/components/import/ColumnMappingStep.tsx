import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { FieldDefinition } from '@/lib/types';

interface ColumnMappingStepProps {
  columns: string[];
  sampleRows: Record<string, unknown>[];
  fieldDefinitions: FieldDefinition[];
  onMappingComplete: (mapping: {
    columnMapping: Record<string, string>;
    titleColumn: string;
    descriptionColumn?: string;
  }) => void;
  onBack: () => void;
}

const SKIP_VALUE = '__skip__';
const TITLE_VALUE = '__title__';
const DESCRIPTION_VALUE = '__description__';

export function ColumnMappingStep({
  columns,
  sampleRows,
  fieldDefinitions,
  onMappingComplete,
  onBack,
}: ColumnMappingStepProps) {
  // Track the mapping for each file column: columnName -> selected target value
  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const col of columns) {
      initial[col] = SKIP_VALUE;
    }
    return initial;
  });

  const [error, setError] = useState<string | null>(null);

  // Collect which target values are already selected (to disable duplicates)
  const selectedTargets = useMemo(() => {
    const targets = new Set<string>();
    for (const val of Object.values(mappings)) {
      if (val !== SKIP_VALUE) {
        targets.add(val);
      }
    }
    return targets;
  }, [mappings]);

  // Determine which required fields are mapped
  const requiredFields = fieldDefinitions.filter((fd) => fd.required);
  const mappedFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const val of Object.values(mappings)) {
      if (val !== SKIP_VALUE && val !== TITLE_VALUE && val !== DESCRIPTION_VALUE) {
        keys.add(val);
      }
    }
    return keys;
  }, [mappings]);

  const hasTitleMapping = Object.values(mappings).includes(TITLE_VALUE);

  function handleMappingChange(column: string, value: string) {
    setMappings((prev) => ({ ...prev, [column]: value }));
    setError(null);
  }

  function handleSubmit() {
    if (!hasTitleMapping) {
      setError('You must map one column to "Title (required)".');
      return;
    }

    // Build the column mapping
    const columnMapping: Record<string, string> = {};
    let titleColumn = '';
    let descriptionColumn: string | undefined;

    for (const [col, target] of Object.entries(mappings)) {
      if (target === SKIP_VALUE) continue;
      if (target === TITLE_VALUE) {
        titleColumn = col;
      } else if (target === DESCRIPTION_VALUE) {
        descriptionColumn = col;
      } else {
        columnMapping[col] = target;
      }
    }

    onMappingComplete({ columnMapping, titleColumn, descriptionColumn });
  }

  // Build option list for selects
  const targetOptions = [
    { value: SKIP_VALUE, label: '(skip this column)' },
    { value: TITLE_VALUE, label: 'Title (required)' },
    { value: DESCRIPTION_VALUE, label: 'Description' },
    ...fieldDefinitions
      .sort((a, b) => a.order - b.order)
      .map((fd) => ({
        value: fd.key,
        label: `${fd.label} (${fd.type})`,
      })),
  ];

  // Sample data preview (first 3 rows)
  const previewRows = sampleRows.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Mapping form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Map File Columns to Program Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Required fields indicator */}
          <div className="flex flex-wrap gap-3 pb-3 border-b">
            <div className="flex items-center gap-1.5">
              {hasTitleMapping ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">Title</span>
            </div>
            {requiredFields.map((fd) => (
              <div key={fd.key} className="flex items-center gap-1.5">
                {mappedFieldKeys.has(fd.key) ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm font-medium">{fd.label}</span>
              </div>
            ))}
          </div>

          {/* Column mapping rows */}
          <div className="space-y-3">
            {columns.map((col) => {
              const sampleValue = sampleRows[0]?.[col];
              return (
                <div key={col} className="grid grid-cols-2 gap-4 items-center">
                  {/* Left: file column name + sample */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{col}</p>
                    {sampleValue !== undefined && sampleValue !== null && (
                      <p className="text-xs text-muted-foreground truncate">
                        Sample: {String(sampleValue)}
                      </p>
                    )}
                  </div>

                  {/* Right: mapping dropdown */}
                  <Select
                    value={mappings[col]}
                    onValueChange={(val) => handleMappingChange(col, val)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select mapping..." />
                    </SelectTrigger>
                    <SelectContent>
                      {targetOptions.map((opt) => {
                        const isSelected = mappings[col] === opt.value;
                        const isTaken =
                          opt.value !== SKIP_VALUE &&
                          selectedTargets.has(opt.value) &&
                          !isSelected;
                        return (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            disabled={isTaken}
                          >
                            {opt.label}
                            {isTaken ? ' (already mapped)' : ''}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Sample data preview */}
      {previewRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sample Data Preview (first {previewRows.length} rows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, idx) => (
                    <TableRow key={idx}>
                      {columns.map((col) => (
                        <TableCell key={col} className="max-w-[200px] truncate">
                          {row[col] !== undefined && row[col] !== null
                            ? String(row[col])
                            : ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleSubmit}>
          Next
        </Button>
      </div>
    </div>
  );
}
