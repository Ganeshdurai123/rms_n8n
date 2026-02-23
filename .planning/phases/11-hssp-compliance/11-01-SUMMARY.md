---
phase: 11-hssp-compliance
plan: 01
subsystem: backend
tags: [checklist, compliance, hssp, dynamic-fields, aggregation]
dependency_graph:
  requires: [program-model, request-service, field-definitions]
  provides: [checklist-field-type, compliance-type, compliance-review-api]
  affects: [program-schema, request-validation, csv-export, import-service]
tech_stack:
  added: []
  patterns: [checklist-completion-aggregation, compliance-type-tagging]
key_files:
  created: []
  modified:
    - server/src/modules/program/program.model.ts
    - server/src/modules/program/program.schema.ts
    - server/src/modules/program/program.service.ts
    - server/src/modules/request/request.service.ts
    - server/src/modules/request/request.controller.ts
    - server/src/modules/request/request.routes.ts
    - server/src/modules/request/import.service.ts
decisions:
  - Checklist field values stored as Array<{label, checked}> in Mongoose Map -- validated at service layer, not schema level
  - computeChecklistCompletion returns zeroes for non-array values (defensive, no throw)
  - CSV export formats checklist as "X/Y (Z%)" instead of raw JSON for readability
  - Import service accepts checklist as JSON string, parses and validates structure
  - Compliance review uses same access-scoping as getRequests (client/team_member/admin/manager)
metrics:
  duration: 5min
  completed: 2026-02-23
---

# Phase 11 Plan 01: HSSP Compliance Backend Summary

Checklist field type with program compliance tagging, validated field storage, compliance review aggregation API, and CSV/import support.

## What Was Built

### Task 1: Program Model and Schema Extensions (1632fbe)

Extended the program model and Zod schemas to support checklist fields and compliance type tagging.

**program.model.ts:**
- Added `'checklist'` to `FIELD_TYPES` array (after checkbox, before file_upload)
- Added optional `items?: string[]` to `IFieldDefinition` for checklist item labels
- Added `items` field to Mongoose fieldDefinitionSchema subdocument
- Added `COMPLIANCE_TYPES = ['hssp'] as const` with `ComplianceType` type
- Added optional `complianceType?: ComplianceType` to `IProgramDocument`
- Added `complianceType` to Mongoose programSchema with enum validation

**program.schema.ts:**
- Updated Zod fieldDefinitionSchema type enum to include `'checklist'`
- Added `items: z.array(z.string().trim().min(1).max(200)).optional()` to field definition
- Added `.refine()` for checklist: items must be defined with at least 1 item
- Added `complianceType: z.enum(['hssp']).optional()` to createProgramSchema
- Added `complianceType: z.enum(['hssp']).nullish()` to updateProgramSchema (nullish for clearing)
- Added `complianceType: z.enum(['hssp']).optional()` to listProgramsQuerySchema

**program.service.ts:**
- Added `complianceType` filter support in `getPrograms` query builder

### Task 2: Checklist Validation, Compliance Review API, CSV/Import (b302826)

Added checklist field validation, compliance review aggregation endpoint, and CSV/import support.

**request.service.ts:**
- Added `case 'checklist':` to `validateFields` switch -- validates Array<{label: string, checked: boolean}>
- Added `computeChecklistCompletion(value)` utility returning {total, checked, percentage}
- Added `getComplianceReview(programId, userId, userRole)` with access-scoped request fetching, per-request completion, and aggregate summary
- Updated `exportRequestsCsv` to format checklist fields as "X/Y (Z%)" in CSV output

**request.controller.ts:**
- Added `getComplianceReview` controller handler returning aggregated compliance data

**request.routes.ts:**
- Added `GET /compliance-review` route before `/:requestId` routes (prevents Express misparse)

**import.service.ts:**
- Added `case 'checklist':` to row validation -- accepts JSON string, validates structure
- Added checklist coercion in `coerceFieldValue` -- parses JSON string to array

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

1. TypeScript compilation: `npx tsc --noEmit` passes with 0 errors
2. Program model exports COMPLIANCE_TYPES with 'hssp': PASS
3. FIELD_TYPES includes 'checklist': PASS
4. fieldDefinitionSchema Zod validates checklist items required: PASS
5. validateFields in request.service.ts has case 'checklist': PASS
6. GET /compliance-review route registered before /:requestId in request.routes.ts: PASS
7. computeChecklistCompletion exported from request.service.ts: PASS

## Commits

| Hash | Message |
|------|---------|
| 1632fbe | feat(11-01): extend program model with checklist field type and complianceType |
| b302826 | feat(11-01): checklist field validation, compliance review API, and CSV export support |

## Self-Check: PASSED

- All 7 modified files exist on disk
- Both task commits (1632fbe, b302826) verified in git log
