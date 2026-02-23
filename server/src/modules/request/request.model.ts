import mongoose, { Schema, Document } from 'mongoose';

/**
 * Valid request statuses representing the lifecycle of a request.
 */
export const REQUEST_STATUSES = [
  'draft',
  'submitted',
  'in_review',
  'approved',
  'rejected',
  'completed',
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/**
 * Valid request priority levels.
 */
export const REQUEST_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type RequestPriority = (typeof REQUEST_PRIORITIES)[number];

/**
 * Full Request document interface.
 * Dynamic field values are stored in a Map keyed to program field definition keys.
 */
export interface IRequestDocument extends Document {
  _id: mongoose.Types.ObjectId;
  programId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  status: RequestStatus;
  fields: Map<string, unknown>;
  createdBy: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  priority: RequestPriority;
  dueDate?: Date;
  chainId?: mongoose.Types.ObjectId;
  chainSequence?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Request schema -- the core entity for tracking submissions within a program.
 * Dynamic field values are stored as a Mongoose Map with mixed values,
 * validated at the service layer against the program's fieldDefinitions.
 */
const requestSchema = new Schema<IRequestDocument>(
  {
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
      required: [true, 'Program ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Request title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title must be at most 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, 'Description must be at most 5000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: REQUEST_STATUSES,
        message: 'Invalid status: {VALUE}',
      },
      default: 'draft',
      index: true,
    },
    fields: {
      type: Map,
      of: Schema.Types.Mixed,
      default: new Map(),
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user is required'],
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    priority: {
      type: String,
      enum: {
        values: REQUEST_PRIORITIES,
        message: 'Invalid priority: {VALUE}',
      },
      default: 'medium',
    },
    dueDate: {
      type: Date,
      default: undefined,
      index: true,
    },
    chainId: {
      type: Schema.Types.ObjectId,
      ref: 'RequestChain',
      index: true,
    },
    chainSequence: {
      type: Number,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for common query patterns
requestSchema.index({ programId: 1, status: 1 });
requestSchema.index({ programId: 1, createdAt: -1 });
requestSchema.index({ assignedTo: 1, status: 1 });
requestSchema.index({ programId: 1, dueDate: 1 });
requestSchema.index({ chainId: 1, chainSequence: 1 });

export const Request = mongoose.model<IRequestDocument>(
  'Request',
  requestSchema,
);
