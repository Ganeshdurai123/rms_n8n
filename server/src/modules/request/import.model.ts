import mongoose, { Schema, Document } from 'mongoose';

/**
 * Valid import job statuses representing the lifecycle of a bulk import.
 */
export const IMPORT_STATUSES = ['pending', 'validated', 'completed', 'failed'] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

/**
 * Per-row validation error detail.
 */
export interface IImportError {
  row: number;
  field: string;
  message: string;
}

/**
 * Full ImportJob document interface.
 * Tracks file parsing, validation, and batch import execution.
 */
export interface IImportJobDocument extends Document {
  _id: mongoose.Types.ObjectId;
  programId: mongoose.Types.ObjectId;
  performedBy: mongoose.Types.ObjectId;
  originalFilename: string;
  status: ImportStatus;
  totalRows: number;
  successCount: number;
  errorCount: number;
  importErrors: IImportError[];
  columnMapping: Map<string, string>;
  parsedData: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ImportJob schema -- tracks bulk import jobs including file parsing,
 * validation results, and batch creation outcomes.
 */
const importJobSchema = new Schema<IImportJobDocument>(
  {
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
      required: [true, 'Program ID is required'],
      index: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Performed by user is required'],
    },
    originalFilename: {
      type: String,
      required: [true, 'Original filename is required'],
    },
    status: {
      type: String,
      enum: {
        values: IMPORT_STATUSES,
        message: 'Invalid import status: {VALUE}',
      },
      default: 'pending',
    },
    totalRows: {
      type: Number,
      required: [true, 'Total rows count is required'],
    },
    successCount: {
      type: Number,
      default: 0,
    },
    errorCount: {
      type: Number,
      default: 0,
    },
    importErrors: {
      type: [
        {
          row: { type: Number, required: true },
          field: { type: String, required: true },
          message: { type: String, required: true },
        },
      ],
      default: [],
    },
    columnMapping: {
      type: Map,
      of: String,
      default: new Map(),
    },
    parsedData: {
      type: [Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for common query patterns
importJobSchema.index({ programId: 1, createdAt: -1 });
importJobSchema.index({ performedBy: 1 });

export const ImportJob = mongoose.model<IImportJobDocument>(
  'ImportJob',
  importJobSchema,
);
