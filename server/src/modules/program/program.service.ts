import { Program } from './program.model.js';
import { AppError, NotFoundError } from '../../shared/errors.js';
import { cacheGet, cacheSet, cacheInvalidate, CACHE_TTL_CONFIG, CACHE_TTL_LIST } from '../../shared/cache.js';
import type { IProgramDocument } from './program.model.js';
import type { CreateProgramInput, UpdateProgramInput, ListProgramsQuery } from './program.schema.js';

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
