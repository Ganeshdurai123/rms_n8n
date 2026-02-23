import mongoose, { Schema, Document } from 'mongoose';

/**
 * Valid report types.
 */
export const REPORT_TYPES = ['summary', 'program', 'overdue'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/**
 * Valid report job statuses.
 */
export const REPORT_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/**
 * Full ReportJob document interface.
 */
export interface IReportJobDocument extends Document {
  _id: mongoose.Types.ObjectId;
  type: ReportType;
  status: ReportStatus;
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  requestedBy: mongoose.Types.ObjectId;
  programId?: mongoose.Types.ObjectId;
  error?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ReportJob schema -- tracks async report generation requests.
 * A user triggers a report, n8n handles aggregation, results stored here.
 */
const reportJobSchema = new Schema<IReportJobDocument>(
  {
    type: {
      type: String,
      required: [true, 'Report type is required'],
      enum: {
        values: REPORT_TYPES,
        message: 'Invalid report type: {VALUE}',
      },
    },
    status: {
      type: String,
      enum: {
        values: REPORT_STATUSES,
        message: 'Invalid report status: {VALUE}',
      },
      default: 'pending',
    },
    params: {
      type: Schema.Types.Mixed,
      default: {},
    },
    result: {
      type: Schema.Types.Mixed,
      default: null,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requested by user is required'],
    },
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
    },
    error: {
      type: String,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for common query patterns
reportJobSchema.index({ requestedBy: 1, createdAt: -1 });
reportJobSchema.index({ status: 1 });
reportJobSchema.index({ programId: 1, type: 1 });

export const ReportJob = mongoose.model<IReportJobDocument>(
  'ReportJob',
  reportJobSchema,
);
