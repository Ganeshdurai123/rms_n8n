import type { ImportExecuteResult } from '@/lib/types';

interface ImportResultStepProps {
  importResult: ImportExecuteResult;
  programId: string;
}

export function ImportResultStep({ importResult, programId }: ImportResultStepProps) {
  // Placeholder -- fully implemented in Task 2
  return (
    <div>
      <p>Import complete: {importResult.successCount} of {importResult.totalRows} rows imported</p>
      <a href={`/programs/${programId}/sheet`}>View in Sheet</a>
    </div>
  );
}
