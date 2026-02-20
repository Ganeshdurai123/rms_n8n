import mongoose, { Schema, Document } from 'mongoose';

/**
 * Program-level roles. Admin is NOT a program role -- admins have implicit
 * access to all programs (handled in authorize middleware in Phase 2).
 */
export type ProgramRole = 'manager' | 'team_member' | 'client';

export interface IProgramMemberDocument extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  programId: mongoose.Types.ObjectId;
  role: ProgramRole;
  addedBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ProgramMember model -- the bridge between users and programs.
 *
 * Design decision: ProgramMember is a separate collection, not embedded in
 * User or Program. Per ARCHITECTURE.md Pattern 3, this allows a user to be
 * a manager in Program A but a team_member in Program B. The compound unique
 * index prevents duplicate memberships.
 *
 * The programId references a Program model that will be created in Phase 2.
 * MongoDB does not enforce foreign key constraints, so the ObjectId reference
 * is fine to create now.
 */
const programMemberSchema = new Schema<IProgramMemberDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    programId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Program ID is required'],
      // ref: 'Program' -- will reference Program model created in Phase 2
    },
    role: {
      type: String,
      enum: {
        values: ['manager', 'team_member', 'client'],
        message: '{VALUE} is not a valid program role',
      },
      required: [true, 'Program role is required'],
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Added by user ID is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound unique index: a user can only have one role per program
programMemberSchema.index({ userId: 1, programId: 1 }, { unique: true });

// Index for listing members of a program
programMemberSchema.index({ programId: 1 });

// Index for listing a user's program memberships
programMemberSchema.index({ userId: 1 });

export const ProgramMember = mongoose.model<IProgramMemberDocument>(
  'ProgramMember',
  programMemberSchema,
);
