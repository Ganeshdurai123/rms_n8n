import { z } from 'zod';

/**
 * Schema for admin creating a new user.
 * Unlike self-registration (auth.schema.ts registerSchema), admin can assign any role.
 */
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(50).trim(),
  lastName: z.string().min(1).max(50).trim(),
  role: z.enum(['admin', 'manager', 'team_member', 'client']),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * Schema for admin updating an existing user.
 * All fields optional -- only provided fields are updated.
 */
export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(50).trim().optional(),
  lastName: z.string().min(1).max(50).trim().optional(),
  role: z.enum(['admin', 'manager', 'team_member', 'client']).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * Schema for assigning a user to a program with a program-level role.
 */
export const assignProgramSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  programId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid program ID'),
  role: z.enum(['manager', 'team_member', 'client']),
});

export type AssignProgramInput = z.infer<typeof assignProgramSchema>;

/**
 * Schema for query parameters when listing users.
 * Supports pagination, role filter, active status filter, and text search.
 */
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['admin', 'manager', 'team_member', 'client']).optional(),
  isActive: z
    .preprocess(
      (val) => (val === 'true' ? true : val === 'false' ? false : val),
      z.boolean().optional(),
    ),
  search: z.string().max(100).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
