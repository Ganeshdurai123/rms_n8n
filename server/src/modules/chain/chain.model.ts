import mongoose, { Schema, Document } from 'mongoose';

/**
 * Valid chain statuses.
 */
export const CHAIN_STATUSES = ['active', 'completed'] as const;
export type ChainStatus = (typeof CHAIN_STATUSES)[number];

/**
 * A single step in a request chain.
 * Maps a request to its position in the execution sequence.
 */
export interface IChainStep {
  requestId: mongoose.Types.ObjectId;
  sequence: number;
}

/**
 * Full RequestChain document interface.
 * Represents an ordered sequence of requests within a program.
 */
export interface IRequestChainDocument extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  programId: mongoose.Types.ObjectId;
  steps: IChainStep[];
  status: ChainStatus;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Step subdocument schema.
 * Suppress auto _id -- requestId serves as identifier (same pattern as fieldDefinitions in program.model.ts).
 */
const chainStepSchema = new Schema<IChainStep>(
  {
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'Request',
      required: [true, 'Request ID is required for chain step'],
    },
    sequence: {
      type: Number,
      required: [true, 'Sequence is required for chain step'],
      min: [1, 'Sequence must be at least 1'],
    },
  },
  { _id: false },
);

/**
 * RequestChain schema -- an ordered sequence of requests within a program.
 * When a request in the chain completes, the next step auto-transitions to submitted.
 */
const requestChainSchema = new Schema<IRequestChainDocument>(
  {
    name: {
      type: String,
      required: [true, 'Chain name is required'],
      trim: true,
      minlength: [3, 'Chain name must be at least 3 characters'],
      maxlength: [100, 'Chain name must be at most 100 characters'],
    },
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
      required: [true, 'Program ID is required'],
      index: true,
    },
    steps: {
      type: [chainStepSchema],
      required: true,
      validate: {
        validator: (v: IChainStep[]) => v.length >= 2,
        message: 'A chain must have at least 2 steps',
      },
    },
    status: {
      type: String,
      enum: {
        values: CHAIN_STATUSES,
        message: 'Invalid chain status: {VALUE}',
      },
      default: 'active',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user is required'],
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for listing chains by program
requestChainSchema.index({ programId: 1, createdAt: -1 });

export const RequestChain = mongoose.model<IRequestChainDocument>(
  'RequestChain',
  requestChainSchema,
);
