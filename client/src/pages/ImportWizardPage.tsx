import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { FileUploadStep } from '@/components/import/FileUploadStep';
import { ColumnMappingStep } from '@/components/import/ColumnMappingStep';
import { ValidationPreviewStep } from '@/components/import/ValidationPreviewStep';
import { ImportResultStep } from '@/components/import/ImportResultStep';
import type {
  Program,
  ImportUploadResult,
  ImportValidationResult,
  ImportExecuteResult,
} from '@/lib/types';

const STEPS = [
  { number: 1, label: 'Upload File' },
  { number: 2, label: 'Map Columns' },
  { number: 3, label: 'Preview & Validate' },
  { number: 4, label: 'Import' },
];

export function ImportWizardPage() {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();

  // Program data
  const [program, setProgram] = useState<Program | null>(null);
  const [programLoading, setProgramLoading] = useState(true);

  // Step state
  const [currentStep, setCurrentStep] = useState(1);

  // Data from each step
  const [uploadResult, setUploadResult] = useState<ImportUploadResult | null>(null);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportExecuteResult | null>(null);

  // Loading states
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Fetch program data on mount
  useEffect(() => {
    if (!programId) return;
    let cancelled = false;

    async function fetchProgram() {
      setProgramLoading(true);
      try {
        const { data } = await api.get(`/programs/${programId}`);
        if (!cancelled) {
          setProgram(data.data || data);
        }
      } catch {
        if (!cancelled) {
          toast.error('Failed to load program');
        }
      } finally {
        if (!cancelled) {
          setProgramLoading(false);
        }
      }
    }

    fetchProgram();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  // Step 1 -> 2: upload complete
  function handleUploadComplete(result: ImportUploadResult) {
    setUploadResult(result);
    setCurrentStep(2);
  }

  // Step 2 -> 3: mapping complete, call validate API
  async function handleMappingComplete(mapping: {
    columnMapping: Record<string, string>;
    titleColumn: string;
    descriptionColumn?: string;
  }) {
    if (!uploadResult) return;

    setIsValidating(true);
    try {
      const { data } = await api.post(
        `/programs/${programId}/requests/import/validate`,
        {
          importJobId: uploadResult.importJobId,
          columnMapping: mapping.columnMapping,
          titleColumn: mapping.titleColumn,
          descriptionColumn: mapping.descriptionColumn,
        },
      );
      setValidationResult(data.data);
      setCurrentStep(3);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Validation failed';
      toast.error(message);
    } finally {
      setIsValidating(false);
    }
  }

  // Step 3 -> 4: execute import
  async function handleExecuteImport() {
    if (!uploadResult) return;

    setIsImporting(true);
    try {
      const { data } = await api.post(
        `/programs/${programId}/requests/import/execute`,
        { importJobId: uploadResult.importJobId },
      );
      setImportResult(data.data);
      setCurrentStep(4);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Import execution failed';
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  }

  if (programLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Import Requests</h1>
          {program && (
            <p className="text-muted-foreground">{program.name}</p>
          )}
        </div>
        <Button variant="outline" asChild>
          <Link to={`/programs/${programId}/sheet`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sheet
          </Link>
        </Button>
      </div>

      {/* Step indicator */}
      <div className="space-y-3">
        <div className="flex justify-between">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className={`flex items-center gap-2 text-sm font-medium ${
                step.number === currentStep
                  ? 'text-primary'
                  : step.number < currentStep
                    ? 'text-green-600'
                    : 'text-muted-foreground'
              }`}
            >
              <div
                className={`flex items-center justify-center h-7 w-7 rounded-full border-2 text-xs font-bold ${
                  step.number === currentStep
                    ? 'border-primary bg-primary text-primary-foreground'
                    : step.number < currentStep
                      ? 'border-green-600 bg-green-600 text-white'
                      : 'border-muted-foreground/30'
                }`}
              >
                {step.number < currentStep ? (
                  <Check className="h-4 w-4" />
                ) : (
                  step.number
                )}
              </div>
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          ))}
        </div>
        <Progress value={(currentStep / STEPS.length) * 100} />
      </div>

      {/* Step content */}
      {currentStep === 1 && programId && (
        <FileUploadStep
          programId={programId}
          onUploadComplete={handleUploadComplete}
        />
      )}

      {currentStep === 2 && uploadResult && program && (
        <ColumnMappingStep
          columns={uploadResult.columns}
          sampleRows={uploadResult.sampleRows}
          fieldDefinitions={program.fieldDefinitions}
          onMappingComplete={handleMappingComplete}
          onBack={() => setCurrentStep(1)}
        />
      )}

      {currentStep === 3 && validationResult && (
        <ValidationPreviewStep
          validationResult={validationResult}
          onExecuteImport={handleExecuteImport}
          onBack={() => setCurrentStep(2)}
          isImporting={isImporting}
        />
      )}

      {currentStep === 4 && importResult && programId && (
        <ImportResultStep
          importResult={importResult}
          programId={programId}
        />
      )}

      {/* Validating overlay */}
      {isValidating && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">Validating mapped data...</p>
          </div>
        </div>
      )}
    </div>
  );
}
