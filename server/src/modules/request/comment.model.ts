import mongoose, { Schema, Document } from 'mongoose';

/**
 * Comment document interface.
 * Comments are linked to requests for activity tracking.
 */
export interface ICommentDocument extends Document {
  _id: mongoose.Types.ObjectId;
  requestId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Comment schema -- threaded comments on a request for collaboration.
 */
const commentSchema = new Schema<ICommentDocument>(
  {
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'Request',
      required: [true, 'Request ID is required'],
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author ID is required'],
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      minlength: [1, 'Comment must be at least 1 character'],
      maxlength: [5000, 'Comment must be at most 5000 characters'],
    },
  },
  {
    timestamps: true,
  },
);

// Index for timeline ordering within a request
commentSchema.index({ requestId: 1, createdAt: 1 });

export const Comment = mongoose.model<ICommentDocument>(
  'Comment',
  commentSchema,
);
