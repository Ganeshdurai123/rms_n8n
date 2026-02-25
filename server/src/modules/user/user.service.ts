import mongoose from 'mongoose';
import { User } from '../auth/auth.model.js';
import { RefreshToken } from '../auth/refreshToken.model.js';
import { ProgramMember } from './programMember.model.js';
import { AppError, NotFoundError } from '../../shared/errors.js';
import type { CreateUserInput, UpdateUserInput, AssignProgramInput, ListUsersQuery } from './user.schema.js';

/**
 * Create a new user (admin action).
 * Unlike self-registration, admin can assign any of the 4 roles.
 */
export async function createUser(data: CreateUserInput, _createdBy: string) {
  // Check if email already exists
  const existing = await User.findOne({ email: data.email.toLowerCase() });
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  // Create user with explicitly assigned role
  const user = await User.create({
    email: data.email,
    password: data.password,
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role,
  });

  // Return user without password and internal Mongoose fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userObj = user.toObject() as any;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, __v, ...sanitized } = userObj;
  return sanitized;
}

/**
 * Get paginated list of users with optional filters.
 * Supports filtering by role, isActive status, and text search on name/email.
 */
export async function getUsers(query: ListUsersQuery) {
  const filter: Record<string, unknown> = {};

  if (query.role) {
    filter.role = query.role;
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive;
  }

  if (query.search) {
    const searchRegex = { $regex: query.search, $options: 'i' };
    filter.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
    ];
  }

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    User.countDocuments(filter),
  ]);

  return { users, total, page, limit };
}

/**
 * Get a single user by ID, including their program memberships.
 */
export async function getUserById(userId: string) {
  const user = await User.findById(userId).select('-password').lean();

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Fetch user's program memberships
  const memberships = await ProgramMember.find({ userId, isActive: true })
    .populate('programId', 'name')
    .lean();

  return { ...user, memberships };
}

/**
 * Update a user's details (admin action).
 * If email is being changed, checks for uniqueness.
 */
export async function updateUser(userId: string, data: UpdateUserInput) {
  // If email is being changed, check uniqueness
  if (data.email) {
    const existing = await User.findOne({
      email: data.email.toLowerCase(),
      _id: { $ne: userId },
    });
    if (existing) {
      throw new AppError('Email already registered', 409);
    }
  }

  const user = await User.findByIdAndUpdate(userId, data, {
    new: true,
    runValidators: true,
  }).select('-password');

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
}

/**
 * Deactivate a user account (soft delete).
 * Also revokes ALL refresh tokens for immediate session termination.
 * Users are never hard-deleted -- preserves audit trail integrity.
 */
export async function deactivateUser(userId: string) {
  const user = await User.findByIdAndUpdate(
    userId,
    { isActive: false },
    { new: true, runValidators: true },
  ).select('-password');

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Revoke ALL refresh tokens for this user -- immediate logout everywhere
  await RefreshToken.updateMany(
    { userId: new mongoose.Types.ObjectId(userId) },
    { isRevoked: true },
  );

  return user;
}

/**
 * Assign a user to a program with a program-level role.
 * Verifies user exists and is active before creating membership.
 */
export async function assignToProgram(data: AssignProgramInput, assignedBy: string) {
  // Verify the user exists and is active
  const user = await User.findById(data.userId);
  if (!user || !user.isActive) {
    throw new NotFoundError('User not found or inactive');
  }

  try {
    const membership = await ProgramMember.create({
      userId: data.userId,
      programId: data.programId,
      role: data.role,
      addedBy: assignedBy,
    });

    return membership;
  } catch (err: unknown) {
    // Handle duplicate compound index violation (user already assigned to program)
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      throw new AppError('User already assigned to this program', 409);
    }
    throw err;
  }
}

/**
 * Hard-delete a user account permanently.
 * Also removes all refresh tokens and program memberships.
 */
export async function hardDeleteUser(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Remove all refresh tokens
  await RefreshToken.deleteMany({ userId: new mongoose.Types.ObjectId(userId) });

  // Remove all program memberships
  await ProgramMember.deleteMany({ userId });

  // Delete the user
  await User.findByIdAndDelete(userId);
}

/**
 * Remove a user's membership from a program.
 */
export async function removeFromProgram(userId: string, programId: string) {
  const result = await ProgramMember.deleteOne({ userId, programId });

  if (result.deletedCount === 0) {
    throw new NotFoundError('Membership not found');
  }
}
