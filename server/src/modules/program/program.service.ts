import mongoose from 'mongoose';
import { Program } from './program.model.js';
import { Request as RequestDoc } from '../request/request.model.js';
import { ProgramMember } from '../user/programMember.model.js';
import { User } from '../auth/auth.model.js';
import { AppError, NotFoundError } from '../../shared/errors.js';
import { cacheGet, cacheSet, cacheInvalidate, CACHE_TTL_CONFIG, CACHE_TTL_LIST } from '../../shared/cache.js';
import type { IProgramDocument } from './program.model.js';
import type { Role } from '../../shared/types.js';
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
 * Access-scoped: non-admin users see ONLY programs they are members of (PROG-06).
 * Admin users see all programs.
 * Manager users see programs they are members of (as manager) PLUS programs they created.
 */
export async function getPrograms(query: ListProgramsQuery, userId: string, userRole: Role) {
  // Cache key includes userId for non-admin users (access-scoped results)
  const cacheKey = userRole === 'admin'
    ? `programs:list:admin:${JSON.stringify(query)}`
    : `programs:list:${userId}:${JSON.stringify(query)}`;
  const cached = await cacheGet<{ programs: IProgramDocument[]; total: number; page: number; limit: number }>(cacheKey);

  if (cached) {
    return cached;
  }

  const filter: Record<string, unknown> = {};

  // Access scoping: non-admin users see only their programs
  if (userRole !== 'admin') {
    // Get all programIds where user has an active membership
    const memberships = await ProgramMember.find({ userId, isActive: true })
      .select('programId')
      .lean();
    const memberProgramIds = memberships.map((m) => m.programId);

    if (userRole === 'manager') {
      // Managers see programs they are members of PLUS programs they created
      filter.$or = [
        { _id: { $in: memberProgramIds } },
        { createdBy: userId },
      ];
    } else {
      // team_member and client roles: only see programs they are members of
      filter._id = { $in: memberProgramIds };
    }
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.complianceType) {
    filter.complianceType = query.complianceType;
  }

  if (query.search) {
    const searchRegex = { $regex: query.search, $options: 'i' };
    // If we already have $or from access scoping, use $and to combine
    if (filter.$or) {
      const accessOr = filter.$or;
      delete filter.$or;
      filter.$and = [
        { $or: accessOr as Record<string, unknown>[] },
        { $or: [{ name: searchRegex }, { description: searchRegex }] },
      ];
    } else {
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
      ];
    }
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

  // Attach request counts per program
  const programIds = programs.map((p) => p._id);
  const requestCounts = await RequestDoc.aggregate([
    { $match: { programId: { $in: programIds } } },
    { $group: { _id: '$programId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(requestCounts.map((r) => [r._id.toString(), r.count as number]));
  const programsWithCounts = programs.map((p) => ({
    ...p,
    requestCount: countMap.get(p._id.toString()) || 0,
  }));

  const result = { programs: programsWithCounts, total, page, limit };

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

// --- Boundary Enforcement ---

/**
 * Check if a program's timeframe allows submission-related actions.
 * Throws an AppError if the program is archived, hasn't started, or has ended.
 * Reusable utility for Phase 3 (Request module) to enforce submission boundaries.
 */
export async function checkProgramTimeframe(programId: string): Promise<void> {
  const program = await getProgramById(programId);

  if (program.status === 'archived') {
    throw new AppError('Program is archived and not accepting submissions', 400);
  }

  const now = new Date();

  if (program.timeframes?.startDate && new Date(program.timeframes.startDate) > now) {
    throw new AppError('Program has not started accepting submissions yet', 400);
  }

  if (program.timeframes?.endDate && new Date(program.timeframes.endDate) < now) {
    throw new AppError('Program submission period has ended', 400);
  }
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

// --- Boundary Stats ---

/**
 * Get boundary utilization statistics for a program.
 * Returns current active request counts vs configured limits, plus per-user breakdown.
 */
export async function getBoundaryStats(programId: string) {
  const program = await getProgramById(programId);

  const activeStatuses = ['submitted', 'in_review', 'approved'];

  // Total active request count
  const totalActiveRequests = await RequestDoc.countDocuments({
    programId,
    status: { $in: activeStatuses },
  });

  // Per-user active request counts (aggregate by createdBy)
  const perUserCounts = await RequestDoc.aggregate([
    {
      $match: {
        programId: new mongoose.Types.ObjectId(programId),
        status: { $in: activeStatuses },
      },
    },
    {
      $group: {
        _id: '$createdBy',
        activeCount: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
        pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }],
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        userId: '$_id',
        activeCount: 1,
        name: {
          $cond: {
            if: '$user',
            then: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
            else: 'Unknown User',
          },
        },
        email: { $ifNull: ['$user.email', null] },
      },
    },
    { $sort: { activeCount: -1 } },
  ]);

  return {
    programId,
    programName: program.name,
    limits: {
      maxActiveRequests: program.settings?.maxActiveRequests ?? null,
      maxActiveRequestsPerUser: program.settings?.maxActiveRequestsPerUser ?? null,
    },
    usage: {
      totalActiveRequests,
      perUser: perUserCounts.map((u: any) => ({
        userId: u.userId.toString(),
        name: u.name,
        email: u.email,
        activeCount: u.activeCount,
      })),
    },
  };
}
