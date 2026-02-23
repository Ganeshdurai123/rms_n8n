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
  // Placeholder -- fully implemented in Task 2
  return (
    <div>
      <p>Validation preview: {validationResult.totalRows} rows</p>
      <button onClick={onBack} disabled={isImporting}>Back</button>
      <button onClick={onExecuteImport} disabled={isImporting}>Import</button>
    </div>
  );
}
