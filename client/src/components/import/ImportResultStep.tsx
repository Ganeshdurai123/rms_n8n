import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ImportExecuteResult } from '@/lib/types';

interface ImportResultStepProps {
  importResult: ImportExecuteResult;
  programId: string;
}

export function ImportResultStep({ importResult, programId }: ImportResultStepProps) {
  const navigate = useNavigate();
  const { successCount, errorCount, totalRows } = importResult;
  const hasSuccess = successCount > 0;

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="text-center">
        {hasSuccess ? (
          <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-2" />
        ) : (
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-2" />
        )}
        <CardTitle className="text-xl">Import Complete</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <p className="text-2xl font-bold">{totalRows}</p>
            <p className="text-xs text-muted-foreground">Total Rows</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-green-600">{successCount}</p>
            <p className="text-xs text-muted-foreground">Imported</p>
          </div>
          {errorCount > 0 && (
            <div className="space-y-1">
              <p className="text-2xl font-bold text-red-500">{errorCount}</p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            onClick={() => navigate(`/programs/${programId}/sheet`)}
          >
            View in Sheet
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate(`/programs/${programId}/import`)}
          >
            Import Another File
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
