import { Program } from './program.model.js';
import { ProgramMember } from '../user/programMember.model.js';
import { User } from '../auth/auth.model.js';
import { AppError, NotFoundError } from '../../shared/errors.js';
import { cacheGet, cacheSet, cacheInvalidate, CACHE_TTL_CONFIG, CACHE_TTL_LIST } from '../../shared/cache.js';
import type { IProgramDocument } from './program.model.js';
import type { CreateProgramInput, UpdateProgramInput, ListProgramsQuery, AddMemberInput, ListMembersQuery } from './program.schema.js';

/**
 * Escape special regex characters in a string for safe use in RegExp constructor.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a new program.
 * Checks for duplicate name (case-insensitive) before creating.
 */
export async function createProgram(data: CreateProgramInput, userId: string): Promise<IProgramDocument> {
  // Check for duplicate program name (case-insensitive)
  const existing = await Program.findOne({
    name: { $regex: new RegExp('^' + escapeRegex(data.name) + '$', 'i') },
  });

  if (existing) {
    throw new AppError('Program name already exists', 409);
  }

  const program = await Program.create({
    ...data,
    createdBy: userId,
  });

  // Invalidate program list cache
  await cacheInvalidate('programs:list:*');

  return program;
}

/**
 * Get a single program by ID with caching.
 * Returns full program document including fieldDefinitions.
 */
export async function getProgramById(programId: string): Promise<IProgramDocument> {
  // Check cache first
  const cacheKey = `programs:${programId}`;
  const cached = await cacheGet<IProgramDocument>(cacheKey);

  if (cached) {
    return cached;
  }

  const program = await Program.findById(programId).lean();

  if (!program) {
    throw new NotFoundError('Program not found');
  }

  // Cache for subsequent reads
  await cacheSet(cacheKey, program, CACHE_TTL_CONFIG);

  return program as unknown as IProgramDocument;
}

/**
 * Get paginated list of programs with optional filters.
 * Supports filtering by status and text search on name/description.
 */
export async function getPrograms(query: ListProgramsQuery) {
  const cacheKey = `programs:list:${JSON.stringify(query)}`;
  const cached = await cacheGet<{ programs: IProgramDocument[]; total: number; page: number; limit: number }>(cacheKey);

  if (cached) {
    return cached;
  }

  const filter: Record<string, unknown> = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search) {
    const searchRegex = { $regex: query.search, $options: 'i' };
    filter.$or = [
      { name: searchRegex },
      { description: searchRegex },
    ];
  }

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [programs, total] = await Promise.all([
    Program.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    Program.countDocuments(filter),
  ]);

  const result = { programs, total, page, limit };

  // Cache list results
  await cacheSet(cacheKey, result, CACHE_TTL_LIST);

  return result;
}

/**
 * Update an existing program.
 * Validates: program exists, not archived, name uniqueness if changed.
 */
export async function updateProgram(programId: string, data: UpdateProgramInput): Promise<IProgramDocument> {
  const program = await Program.findById(programId);

  if (!program) {
    throw new NotFoundError('Program not found');
  }

  if (program.status === 'archived') {
    throw new AppError('Cannot update an archived program', 400);
  }

  // If name is being changed, check uniqueness (case-insensitive)
  if (data.name && data.name.toLowerCase() !== program.name.toLowerCase()) {
    const existing = await Program.findOne({
      name: { $regex: new RegExp('^' + escapeRegex(data.name) + '$', 'i') },
      _id: { $ne: programId },
    });

    if (existing) {
      throw new AppError('Program name already exists', 409);
    }
  }

  const updated = await Program.findByIdAndUpdate(programId, data, {
    new: true,
    runValidators: true,
  });

  if (!updated) {
    throw new NotFoundError('Program not found');
  }

  // Invalidate caches
  await cacheInvalidate(`programs:${programId}`);
  await cacheInvalidate('programs:list:*');

  return updated;
}

/**
 * Archive a program (soft state change, not deletion).
 */
export async function archiveProgram(programId: string): Promise<IProgramDocument> {
  const program = await Program.findById(programId);

  if (!program) {
    throw new NotFoundError('Program not found');
  }

  if (program.status === 'archived') {
    throw new AppError('Program is already archived', 400);
  }

  program.status = 'archived';
  await program.save();

  // Invalidate caches
  await cacheInvalidate(`programs:${programId}`);
  await cacheInvalidate('programs:list:*');

  return program;
}

// --- Member Management ---

/**
 * Add a member to a program with a specific program-level role.
 * Verifies program exists and is active, and user exists and is active.
 * Handles duplicate membership with 409 (same pattern as user.service.ts assignToProgram).
 */
export async function addMember(programId: string, data: AddMemberInput, addedBy: string) {
  // Verify program exists and is active
  const program = await Program.findById(programId);
  if (!program) {
    throw new NotFoundError('Program not found');
  }
  if (program.status === 'archived') {
    throw new AppError('Cannot add members to an archived program', 400);
  }

  // Verify user exists and is active
  const user = await User.findById(data.userId);
  if (!user || !user.isActive) {
    throw new NotFoundError('User not found or inactive');
  }

  try {
    const membership = await ProgramMember.create({
      userId: data.userId,
      programId,
      role: data.role,
      addedBy,
    });

    // Invalidate member cache
    await cacheInvalidate(`programs:${programId}:members:*`);
    // Invalidate program list cache since membership changes affect access-scoped listing
    await cacheInvalidate('programs:list:*');

    return membership;
  } catch (err: unknown) {
    // Handle duplicate compound index violation (user already a member)
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      throw new AppError('User is already a member of this program', 409);
    }
    throw err;
  }
}

/**
 * Remove a member from a program.
 * Deletes by member _id AND programId (both must match for safety).
 */
export async function removeMember(programId: string, memberId: string) {
  const result = await ProgramMember.deleteOne({ _id: memberId, programId });

  if (result.deletedCount === 0) {
    throw new NotFoundError('Membership not found');
  }

  // Invalidate member cache
  await cacheInvalidate(`programs:${programId}:members:*`);
  // Invalidate program list cache since membership changes affect access-scoped listing
  await cacheInvalidate('programs:list:*');
}

/**
 * Get paginated list of members for a program.
 * Populates only safe user fields per PITFALLS.md Pitfall 6.
 */
export async function getMembers(programId: string, query: ListMembersQuery) {
  const filter: Record<string, unknown> = { programId, isActive: true };

  if (query.role) {
    filter.role = query.role;
  }

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [members, total] = await Promise.all([
    ProgramMember.find(filter)
      .populate('userId', 'firstName lastName email role')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    ProgramMember.countDocuments(filter),
  ]);

  return { members, total, page, limit };
}
