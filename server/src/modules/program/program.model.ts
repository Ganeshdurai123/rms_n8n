import mongoose, { Schema, Document } from 'mongoose';

/**
 * Supported dynamic field types for program field definitions.
 */
export const FIELD_TYPES = [
  'text',
  'number',
  'date',
  'dropdown',
  'checkbox',
  'file_upload',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * A single dynamic field definition embedded in a program.
 * Fields use `key` as their identifier (no Mongoose _id on subdocuments).
 */
export interface IFieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
  order: number;
}

/**
 * Program statuses.
 */
export const PROGRAM_STATUSES = ['active', 'archived'] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

/**
 * Due date configuration for a program.
 * Controls how due dates are computed for requests in this program.
 */
export interface IDueDateConfig {
  enabled: boolean;
  defaultOffsetDays: number;
  dueDateField?: string;
}

/**
 * Full Program document interface.
 */
export interface IProgramDocument extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  fieldDefinitions: IFieldDefinition[];
  settings: {
    allowClientSubmission: boolean;
    requireApproval: boolean;
    maxActiveRequests?: number;
  };
  timeframes: {
    startDate?: Date;
    endDate?: Date;
  };
  dueDateConfig: IDueDateConfig;
  status: ProgramStatus;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * FieldDefinition sub-schema (embedded, not a separate collection).
 * Uses `key` as the identifier -- Mongoose auto _id suppressed.
 */
const fieldDefinitionSchema = new Schema<IFieldDefinition>(
  {
    key: {
      type: String,
      required: [true, 'Field key is required'],
      validate: {
        validator: (v: string) => /^[a-z][a-z0-9_]*$/.test(v),
        message:
          'Field key must start with a lowercase letter and contain only lowercase letters, numbers, and underscores',
      },
    },
    label: {
      type: String,
      required: [true, 'Field label is required'],
      trim: true,
      maxlength: [100, 'Field label must be at most 100 characters'],
    },
    type: {
      type: String,
      required: [true, 'Field type is required'],
      enum: {
        values: FIELD_TYPES,
        message: 'Invalid field type: {VALUE}',
      },
    },
    required: {
      type: Boolean,
      default: false,
    },
    options: {
      type: [String],
      default: undefined, // Only meaningful for dropdown type
    },
    placeholder: {
      type: String,
      maxlength: [200, 'Placeholder must be at most 200 characters'],
    },
    order: {
      type: Number,
      required: [true, 'Field order is required'],
    },
  },
  {
    _id: false, // Use `key` as identifier, suppress auto _id
  },
);

/**
 * Program schema -- the core organizational unit for managing requests.
 */
const programSchema = new Schema<IProgramDocument>(
  {
    name: {
      type: String,
      required: [true, 'Program name is required'],
      trim: true,
      minlength: [2, 'Program name must be at least 2 characters'],
      maxlength: [100, 'Program name must be at most 100 characters'],
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description must be at most 2000 characters'],
    },
    fieldDefinitions: {
      type: [fieldDefinitionSchema],
      default: [],
    },
    settings: {
      allowClientSubmission: {
        type: Boolean,
        default: true,
      },
      requireApproval: {
        type: Boolean,
        default: true,
      },
      maxActiveRequests: {
        type: Number,
        default: undefined,
      },
    },
    timeframes: {
      startDate: {
        type: Date,
        default: undefined,
      },
      endDate: {
        type: Date,
        default: undefined,
      },
    },
    dueDateConfig: {
      enabled: {
        type: Boolean,
        default: false,
      },
      defaultOffsetDays: {
        type: Number,
        default: 30,
      },
      dueDateField: {
        type: String,
        default: undefined,
      },
    },
    status: {
      type: String,
      enum: {
        values: PROGRAM_STATUSES,
        message: 'Invalid status: {VALUE}',
      },
      default: 'active',
      index: true,
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

// Indexes
programSchema.index({ name: 1 }, { unique: true });
programSchema.index({ status: 1, createdAt: -1 });
programSchema.index({ createdBy: 1 });

export const Program = mongoose.model<IProgramDocument>(
  'Program',
  programSchema,
);
