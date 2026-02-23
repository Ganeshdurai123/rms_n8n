import fs from 'fs';
import * as XLSX from 'xlsx';
import { ImportJob } from './import.model.js';
import { Request as RequestModel } from './request.model.js';
import { getProgramById } from '../program/program.service.js';
import { createAuditEntry } from '../audit/audit.utils.js';
import { cacheInvalidate } from '../../shared/cache.js';
import { emitToProgram } from '../../config/socket.js';
import { User } from '../auth/auth.model.js';
import { AppError, NotFoundError } from '../../shared/errors.js';
import logger from '../../config/logger.js';
import type { IFieldDefinition } from '../program/program.model.js';
import type { IImportError } from './import.model.js';
import type { Role } from '../../shared/types.js';

/**
 * Look up a user's display name for socket event payloads.
 */
async function getPerformerName(userId: string): Promise<{ userId: string; name: string }> {
  const user = await User.findById(userId).select('firstName lastName').lean();
  return {
    userId,
    name: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
  };
}

/**
 * Parse an uploaded Excel/CSV file and create an ImportJob record.
 * Returns column headers, sample rows, and the import job ID for subsequent steps.
 */
export async function parseUploadedFile(
  filePath: string,
  originalFilename: string,
  programId: string,
  userId: string,
) {
  // Read the file with xlsx (handles both .xlsx and .csv)
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new AppError('Uploaded file contains no sheets', 400);
  }

  const sheet = workbook.Sheets[firstSheetName];

  // Convert to array-of-arrays (header: 1 mode)
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  if (rawData.length < 2) {
    throw new AppError('File must contain at least a header row and one data row', 400);
  }

  // First row = column headers
  const headers = (rawData[0] as unknown[]).map((h) =>
    h !== null && h !== undefined ? String(h).trim() : '',
  );

  // Remaining rows = data
  const dataRows = rawData.slice(1).filter((row) => {
    // Filter out completely empty rows
    return (row as unknown[]).some(
      (cell) => cell !== null && cell !== undefined && String(cell).trim() !== '',
    );
  });

  // Convert array-of-arrays to array-of-objects keyed by column headers
  const parsedData = dataRows.map((row) => {
    const obj: Record<string, unknown> = {};
    (row as unknown[]).forEach((cell, idx) => {
      if (idx < headers.length && headers[idx]) {
        obj[headers[idx]] = cell;
      }
    });
    return obj;
  });

  // Create ImportJob record
  const importJob = await ImportJob.create({
    programId,
    performedBy: userId,
    originalFilename,
    status: 'pending',
    totalRows: parsedData.length,
    parsedData,
  });

  // Clean up temp file (fire-and-forget)
  fs.unlink(filePath, (err) => {
    if (err) {
      logger.warn(`Failed to clean up temp import file: ${filePath}`, err);
    }
  });

  // Build sample rows (first 5 data rows as objects)
  const sampleRows = parsedData.slice(0, 5);

  return {
    importJobId: importJob._id.toString(),
    columns: headers.filter((h) => h !== ''),
    sampleRows,
    totalRows: parsedData.length,
  };
}

/**
 * Validate mapped import rows against the program's field definitions.
 * Collects per-row errors instead of throwing on first failure.
 */
export async function validateImportRows(
  importJobId: string,
  columnMapping: Record<string, string>,
  titleColumn: string,
  descriptionColumn?: string,
) {
  const importJob = await ImportJob.findById(importJobId);
  if (!importJob) {
    throw new NotFoundError('Import job not found');
  }

  if (importJob.status !== 'pending') {
    throw new AppError('Import job has already been validated or completed', 400);
  }

  // Load program field definitions
  const program = await getProgramById(importJob.programId.toString());
  const fieldDefinitions = program.fieldDefinitions || [];
  const fieldMap = new Map<string, IFieldDefinition>(
    fieldDefinitions.map((fd) => [fd.key, fd]),
  );

  const errors: IImportError[] = [];
  const validRowIndices: Set<number> = new Set();
  const validMappedRows: Record<string, unknown>[] = [];
  const parsedData = importJob.parsedData as Record<string, unknown>[];

  for (let i = 0; i < parsedData.length; i++) {
    const row = parsedData[i];
    const rowNumber = i + 1;
    let rowHasError = false;

    // Validate title
    const titleValue = row[titleColumn];
    const titleStr = titleValue !== null && titleValue !== undefined ? String(titleValue).trim() : '';

    if (!titleStr) {
      errors.push({ row: rowNumber, field: 'title', message: 'Title is required' });
      rowHasError = true;
    } else if (titleStr.length < 3 || titleStr.length > 200) {
      errors.push({
        row: rowNumber,
        field: 'title',
        message: 'Title must be between 3 and 200 characters',
      });
      rowHasError = true;
    }

    // Validate mapped fields
    for (const [fileColumn, fieldKey] of Object.entries(columnMapping)) {
      const def = fieldMap.get(fieldKey);
      if (!def) {
        errors.push({
          row: rowNumber,
          field: fieldKey,
          message: `Unknown field definition "${fieldKey}"`,
        });
        rowHasError = true;
        continue;
      }

      const rawValue = row[fileColumn];
      const isEmpty =
        rawValue === undefined || rawValue === null || String(rawValue).trim() === '';

      // Required check
      if (def.required && isEmpty) {
        errors.push({
          row: rowNumber,
          field: def.key,
          message: `Field "${def.label}" is required`,
        });
        rowHasError = true;
        continue;
      }

      // Skip type validation if empty and not required
      if (isEmpty) continue;

      const strValue = String(rawValue).trim();

      // Type-specific validation
      switch (def.type) {
        case 'text':
          if (typeof rawValue !== 'string' && typeof rawValue !== 'number') {
            errors.push({
              row: rowNumber,
              field: def.key,
              message: `Field "${def.label}" must be a text value`,
            });
            rowHasError = true;
          }
          break;

        case 'number': {
          const num = parseFloat(strValue);
          if (isNaN(num)) {
            errors.push({
              row: rowNumber,
              field: def.key,
              message: `Field "${def.label}" must be a number`,
            });
            rowHasError = true;
          }
          break;
        }

        case 'date': {
          const dateVal = new Date(strValue);
          if (isNaN(dateVal.getTime())) {
            errors.push({
              row: rowNumber,
              field: def.key,
              message: `Field "${def.label}" must be a valid date`,
            });
            rowHasError = true;
          }
          break;
        }

        case 'dropdown':
          if (def.options && !def.options.includes(strValue)) {
            errors.push({
              row: rowNumber,
              field: def.key,
              message: `Field "${def.label}" must be one of: ${def.options.join(', ')}`,
            });
            rowHasError = true;
          }
          break;

        case 'checkbox': {
          const lower = strValue.toLowerCase();
          if (!['true', 'false', 'yes', 'no', '1', '0'].includes(lower)) {
            errors.push({
              row: rowNumber,
              field: def.key,
              message: `Field "${def.label}" must be true/false, yes/no, or 1/0`,
            });
            rowHasError = true;
          }
          break;
        }

        case 'checklist': {
          // For imports, checklist values should be a JSON string representing Array<{label: string, checked: boolean}>
          try {
            const parsed = JSON.parse(strValue);
            if (!Array.isArray(parsed)) {
              errors.push({
                row: rowNumber,
                field: def.key,
                message: `Field "${def.label}" must be a JSON array of {label, checked} items`,
              });
              rowHasError = true;
            } else {
              for (let j = 0; j < parsed.length; j++) {
                const item = parsed[j];
                if (
                  !item ||
                  typeof item !== 'object' ||
                  typeof item.label !== 'string' ||
                  typeof item.checked !== 'boolean'
                ) {
                  errors.push({
                    row: rowNumber,
                    field: def.key,
                    message: `Field "${def.label}" item at index ${j} must have { label: string, checked: boolean }`,
                  });
                  rowHasError = true;
                  break;
                }
              }
            }
          } catch {
            errors.push({
              row: rowNumber,
              field: def.key,
              message: `Field "${def.label}" must be valid JSON representing a checklist array`,
            });
            rowHasError = true;
          }
          break;
        }

        case 'file_upload':
          // Skip file_upload fields for import -- cannot bulk-import files
          break;
      }
    }

    if (!rowHasError) {
      validRowIndices.add(i);
      if (validMappedRows.length < 5) {
        // Build a preview of mapped row
        const mappedRow: Record<string, unknown> = {
          title: titleStr,
          description: descriptionColumn && row[descriptionColumn]
            ? String(row[descriptionColumn]).trim()
            : undefined,
          fields: {} as Record<string, unknown>,
        };
        for (const [fileColumn, fieldKey] of Object.entries(columnMapping)) {
          const def = fieldMap.get(fieldKey);
          if (def) {
            (mappedRow.fields as Record<string, unknown>)[fieldKey] = coerceFieldValue(
              row[fileColumn],
              def,
            );
          }
        }
        validMappedRows.push(mappedRow);
      }
    }
  }

  // Store columnMapping plus titleColumn/descriptionColumn with reserved keys
  const fullMapping = {
    ...columnMapping,
    __title__: titleColumn,
    ...(descriptionColumn ? { __description__: descriptionColumn } : {}),
  };

  // Update ImportJob
  importJob.status = 'validated';
  importJob.columnMapping = new Map(Object.entries(fullMapping));
  importJob.importErrors = errors;
  importJob.errorCount = new Set(errors.map((e) => e.row)).size; // count unique error rows
  await importJob.save();

  const validCount = parsedData.length - importJob.errorCount;

  return {
    importJobId: importJob._id.toString(),
    totalRows: parsedData.length,
    validCount,
    errorCount: importJob.errorCount,
    errors: errors.slice(0, 100), // Return first 100 errors
    validRows: validMappedRows,
  };
}

/**
 * Coerce a raw cell value to the correct type based on field definition.
 */
function coerceFieldValue(rawValue: unknown, def: IFieldDefinition): unknown {
  if (rawValue === undefined || rawValue === null) return undefined;

  const strValue = String(rawValue).trim();
  if (strValue === '') return undefined;

  switch (def.type) {
    case 'text':
      return strValue;

    case 'number':
      return parseFloat(strValue);

    case 'date':
      return new Date(strValue).toISOString();

    case 'dropdown':
      return strValue;

    case 'checkbox': {
      const lower = strValue.toLowerCase();
      return ['true', 'yes', '1'].includes(lower);
    }

    case 'checklist':
      try {
        return JSON.parse(strValue);
      } catch {
        return undefined;
      }

    case 'file_upload':
      return undefined; // Cannot import files

    default:
      return strValue;
  }
}

/**
 * Execute a validated import by batch-creating draft requests.
 * Skips rows that had validation errors.
 */
export async function executeBatchImport(
  importJobId: string,
  userId: string,
  userRole: Role,
) {
  const importJob = await ImportJob.findById(importJobId);
  if (!importJob) {
    throw new NotFoundError('Import job not found');
  }

  if (importJob.status !== 'validated') {
    throw new AppError('Import job must be validated before execution', 400);
  }

  // Load program for field definitions
  const program = await getProgramById(importJob.programId.toString());
  const fieldDefinitions = program.fieldDefinitions || [];
  const fieldMap = new Map<string, IFieldDefinition>(
    fieldDefinitions.map((fd) => [fd.key, fd]),
  );

  const parsedData = importJob.parsedData as Record<string, unknown>[];
  const columnMapping = Object.fromEntries(importJob.columnMapping || new Map());

  // Determine which rows had errors (by row index)
  const errorRowIndices = new Set(
    (importJob.importErrors || []).map((e) => e.row - 1), // convert 1-based to 0-based
  );

  // Retrieve titleColumn and descriptionColumn stored during validation (reserved keys)
  const titleColumn = columnMapping['__title__'];
  const descriptionColumn = columnMapping['__description__'] || undefined;

  if (!titleColumn) {
    throw new AppError('Title column mapping not found. Please re-validate the import.', 400);
  }

  // Build documents for valid rows only
  const docsToInsert = [];
  for (let i = 0; i < parsedData.length; i++) {
    if (errorRowIndices.has(i)) continue;

    const row = parsedData[i];
    const titleStr = row[titleColumn]
      ? String(row[titleColumn]).trim()
      : '';

    if (!titleStr) continue; // Skip rows with empty titles

    const descStr = descriptionColumn && row[descriptionColumn]
      ? String(row[descriptionColumn]).trim()
      : undefined;

    // Build fields map from column mapping
    const fields: Record<string, unknown> = {};
    for (const [fileColumn, fieldKey] of Object.entries(columnMapping)) {
      // Skip reserved keys for title/description
      if (fieldKey === '__title__' || fieldKey === '__description__') continue;
      const def = fieldMap.get(fieldKey);
      if (def) {
        const coerced = coerceFieldValue(row[fileColumn], def);
        if (coerced !== undefined) {
          fields[fieldKey] = coerced;
        }
      }
    }

    docsToInsert.push({
      programId: importJob.programId,
      title: titleStr,
      description: descStr,
      fields,
      status: 'draft' as const,
      createdBy: userId,
      priority: 'medium' as const,
    });
  }

  let successCount = 0;

  if (docsToInsert.length > 0) {
    try {
      const result = await RequestModel.insertMany(docsToInsert, { ordered: false });
      successCount = result.length;
    } catch (err: unknown) {
      // With ordered: false, partial inserts may succeed
      // Check for BulkWriteError to get insertedCount
      if (
        err instanceof Error &&
        'insertedDocs' in err &&
        Array.isArray((err as { insertedDocs: unknown[] }).insertedDocs)
      ) {
        successCount = (err as { insertedDocs: unknown[] }).insertedDocs.length;
      } else {
        logger.error('Batch import insertMany failed:', err);
        importJob.status = 'failed';
        await importJob.save();
        throw new AppError('Batch import failed', 500);
      }
    }
  }

  // Update ImportJob
  importJob.status = 'completed';
  importJob.successCount = successCount;
  await importJob.save();

  // Audit log: import created
  await createAuditEntry({
    action: 'import.created',
    entityType: 'import',
    entityId: importJob._id.toString(),
    requestId: importJob._id.toString(), // use importJob ID as requestId for audit
    programId: importJob.programId.toString(),
    performedBy: userId,
    metadata: {
      importJobId: importJob._id.toString(),
      totalRows: importJob.totalRows,
      successCount,
      errorCount: importJob.errorCount,
    },
  });

  // Invalidate request list cache
  await cacheInvalidate('requests:list:*');

  // Emit Socket.IO event (fire-and-forget, optional)
  getPerformerName(userId)
    .then((performer) => {
      emitToProgram(importJob.programId.toString(), 'request:created', {
        event: 'request:created',
        programId: importJob.programId.toString(),
        requestId: importJob._id.toString(),
        data: { importJobId: importJob._id.toString(), successCount, totalRows: importJob.totalRows },
        performedBy: performer,
        timestamp: new Date().toISOString(),
      });
    })
    .catch(() => {});

  return {
    importJobId: importJob._id.toString(),
    successCount,
    errorCount: importJob.errorCount,
    totalRows: importJob.totalRows,
  };
}

/**
 * Get paginated import history for a program.
 */
export async function getImportHistory(
  programId: string,
  page: number,
  limit: number,
) {
  const skip = (page - 1) * limit;

  const [imports, total] = await Promise.all([
    ImportJob.find({ programId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('performedBy', 'firstName lastName email')
      .lean(),
    ImportJob.countDocuments({ programId }),
  ]);

  return { imports, total, page, limit };
}
