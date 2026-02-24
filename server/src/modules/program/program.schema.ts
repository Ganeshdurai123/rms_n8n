import { z } from 'zod';

/**
 * Zod schema for a single field definition within a program.
 * Validates that dropdown-type fields include at least one option.
 */
export const fieldDefinitionSchema = z
  .object({
    key: z
      .string()
      .regex(
        /^[a-z][a-z0-9_]*$/,
        'Key must start with a lowercase letter and contain only lowercase letters, numbers, and underscores',
      )
      .max(50),
    label: z.string().min(1, 'Label is required').max(100).trim(),
    type: z.enum([
      'text',
      'number',
      'date',
      'dropdown',
      'checkbox',
      'checklist',
      'file_upload',
    ]),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().max(200)).optional(),
    items: z.array(z.string().trim().min(1).max(200)).optional(),
    placeholder: z.string().max(200).trim().optional(),
    order: z.number().int().min(0),
  })
  .refine(
    (data) => {
      if (data.type === 'dropdown') {
        return data.options !== undefined && data.options.length >= 1;
      }
      return true;
    },
    {
      message: 'Dropdown fields must have at least one option',
      path: ['options'],
    },
  )
  .refine(
    (data) => {
      if (data.type === 'checklist') {
        return data.items !== undefined && data.items.length >= 1;
      }
      return true;
    },
    {
      message: 'Checklist fields must have at least one item',
      path: ['items'],
    },
  );

export type FieldDefinitionInput = z.infer<typeof fieldDefinitionSchema>;

/**
 * Schema for creating a new program (POST /api/v1/programs).
 * Validates unique field keys within the fieldDefinitions array.
 * Validates that endDate is after startDate when both are provided.
 */
/**
 * Zod schema for dueDateConfig embedded subdocument.
 */
const dueDateConfigSchema = z.object({
  enabled: z.boolean().default(false),
  defaultOffsetDays: z.number().int().min(1).max(365).default(30),
  dueDateField: z.string().regex(/^[a-z][a-z0-9_]*$/).optional(),
}).default({});

export const createProgramSchema = z.object({
  name: z.string().min(2, 'Program name must be at least 2 characters').max(100).trim(),
  description: z.string().max(2000).trim().optional(),
  complianceType: z.enum(['hssp']).optional(),
  fieldDefinitions: z
    .array(fieldDefinitionSchema)
    .default([])
    .refine(
      (fields) => {
        const keys = fields.map((f) => f.key);
        return new Set(keys).size === keys.length;
      },
      {
        message: 'Field definition keys must be unique within a program',
      },
    ),
  settings: z
    .object({
      allowClientSubmission: z.boolean().default(true),
      requireApproval: z.boolean().default(true),
      maxActiveRequests: z.number().int().min(0).optional(),
      maxActiveRequestsPerUser: z.number().int().min(1).optional(),
    })
    .default({}),
  timeframes: z
    .object({
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
    })
    .refine(
      (data) => {
        if (data.startDate && data.endDate) {
          return data.endDate > data.startDate;
        }
        return true;
      },
      {
        message: 'End date must be after start date',
        path: ['endDate'],
      },
    )
    .default({}),
  dueDateConfig: dueDateConfigSchema,
}).refine(
  (data) => {
    // If dueDateField is set, it must reference a key in fieldDefinitions with type 'date'
    if (data.dueDateConfig?.dueDateField) {
      const field = data.fieldDefinitions.find(
        (f) => f.key === data.dueDateConfig.dueDateField,
      );
      return field !== undefined && field.type === 'date';
    }
    return true;
  },
  {
    message: 'dueDateConfig.dueDateField must reference a fieldDefinition key with type "date"',
    path: ['dueDateConfig', 'dueDateField'],
  },
);

export type CreateProgramInput = z.infer<typeof createProgramSchema>;

/**
 * Schema for updating an existing program (PATCH /api/v1/programs/:programId).
 * All top-level fields are optional.
 * When updating fieldDefinitions, send the complete array (not a partial merge).
 */
export const updateProgramSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  description: z.string().max(2000).trim().optional(),
  complianceType: z.enum(['hssp']).nullish(),
  fieldDefinitions: z
    .array(fieldDefinitionSchema)
    .refine(
      (fields) => {
        const keys = fields.map((f) => f.key);
        return new Set(keys).size === keys.length;
      },
      {
        message: 'Field definition keys must be unique within a program',
      },
    )
    .optional(),
  settings: z
    .object({
      allowClientSubmission: z.boolean().optional(),
      requireApproval: z.boolean().optional(),
      maxActiveRequests: z.number().int().min(0).optional(),
      maxActiveRequestsPerUser: z.number().int().min(1).optional(),
    })
    .optional(),
  timeframes: z
    .object({
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
    })
    .refine(
      (data) => {
        if (data.startDate && data.endDate) {
          return data.endDate > data.startDate;
        }
        return true;
      },
      {
        message: 'End date must be after start date',
        path: ['endDate'],
      },
    )
    .optional(),
  dueDateConfig: z.object({
    enabled: z.boolean().optional(),
    defaultOffsetDays: z.number().int().min(1).max(365).optional(),
    dueDateField: z.string().regex(/^[a-z][a-z0-9_]*$/).optional(),
  }).optional(),
}).refine(
  (data) => {
    // If both dueDateConfig.dueDateField and fieldDefinitions are provided, validate the reference
    if (data.dueDateConfig?.dueDateField && data.fieldDefinitions) {
      const field = data.fieldDefinitions.find(
        (f) => f.key === data.dueDateConfig!.dueDateField,
      );
      return field !== undefined && field.type === 'date';
    }
    return true;
  },
  {
    message: 'dueDateConfig.dueDateField must reference a fieldDefinition key with type "date"',
    path: ['dueDateConfig', 'dueDateField'],
  },
);

export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;

/**
 * Schema for query parameters when listing programs.
 * Supports pagination, status filter, and text search.
 */
export const listProgramsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'archived']).optional(),
  complianceType: z.enum(['hssp']).optional(),
  search: z.string().max(100).optional(),
});

export type ListProgramsQuery = z.infer<typeof listProgramsQuerySchema>;

/**
 * Schema for adding a member to a program (POST /api/v1/programs/:programId/members).
 */
export const addMemberSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  role: z.enum(['manager', 'team_member', 'client']),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;

/**
 * Schema for query parameters when listing program members.
 */
export const listMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['manager', 'team_member', 'client']).optional(),
});

export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;
