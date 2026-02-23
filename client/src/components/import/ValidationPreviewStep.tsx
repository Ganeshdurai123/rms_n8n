import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ImportValidationResult } from '@/lib/types';

interface ValidationPreviewStepProps {
  validationResult: ImportValidationResult;
  onExecuteImport: () => void;
  onBack: () => void;
  isImporting: boolean;
}

export function ValidationPreviewStep({
  validationResult,
  onExecuteImport,
  onBack,
  isImporting,
}: ValidationPreviewStepProps) {
  const { totalRows, validCount, errorCount, errors, validRows } = validationResult;

  // Collect field keys from valid rows for the preview table
  const fieldKeys: string[] = [];
  if (validRows.length > 0) {
    const firstFields = validRows[0].fields;
    if (firstFields) {
      fieldKeys.push(...Object.keys(firstFields));
    }
  }

  const previewRows = validRows.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Validation Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Total rows: </span>
              <span className="font-medium">{totalRows}</span>
            </div>
            <div className="text-sm flex items-center gap-1.5">
              <span className="text-muted-foreground">Valid rows: </span>
              <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                {validCount}
              </Badge>
            </div>
            {errorCount > 0 && (
              <div className="text-sm flex items-center gap-1.5">
                <span className="text-muted-foreground">Rows with errors: </span>
                <Badge variant="destructive">{errorCount}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Errors section */}
      {errorCount > 0 && errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Errors ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea maxHeight="300px">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Row #</TableHead>
                    <TableHead className="w-[150px]">Field</TableHead>
                    <TableHead>Error Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.map((err, idx) => (
                    <TableRow
                      key={idx}
                      className="border-l-4 border-l-destructive/60"
                    >
                      <TableCell className="font-mono text-sm">{err.row}</TableCell>
                      <TableCell className="font-medium">{err.field}</TableCell>
                      <TableCell className="text-muted-foreground">{err.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Valid rows preview */}
      {previewRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Preview of valid rows (showing {previewRows.length} of {validCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Description</TableHead>
                    {fieldKeys.map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {row.title}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {row.description || '-'}
                      </TableCell>
                      {fieldKeys.map((key) => (
                        <TableCell key={key} className="max-w-[150px] truncate">
                          {row.fields[key] !== undefined && row.fields[key] !== null
                            ? String(row.fields[key])
                            : '-'}
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

      {/* Warning text */}
      {errorCount > 0 && (
        <p className="text-sm text-amber-600 font-medium">
          Rows with errors will be skipped. Only {validCount} valid rows will be imported.
        </p>
      )}

      {/* Action buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isImporting}>
          Back
        </Button>
        <Button
          onClick={onExecuteImport}
          disabled={validCount === 0 || isImporting}
        >
          {isImporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            `Import ${validCount} Rows`
          )}
        </Button>
      </div>
    </div>
  );
}
