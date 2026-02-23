import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import * as importController from './import.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorizeProgram } from '../../middleware/authorizeProgram.js';
import { validate } from '../../middleware/validate.js';
import {
  validateImportSchema,
  executeImportSchema,
  listImportHistorySchema,
} from './import.schema.js';
import { AppError } from '../../shared/errors.js';

const router = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Multer configuration for import file uploads
// ---------------------------------------------------------------------------

const importUploadDir = path.join(process.cwd(), 'uploads', 'imports');

// Ensure upload directory exists at startup
if (!fs.existsSync(importUploadDir)) {
  fs.mkdirSync(importUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, importUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${nanoid()}-${Date.now()}${ext}`);
  },
});

/**
 * Allowed MIME types for import files.
 * CSV files sometimes have text/plain MIME type, so we also check extension.
 */
const ALLOWED_IMPORT_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv',
  'text/plain', // CSV sometimes detected as text/plain
  'application/csv',
];

const ALLOWED_IMPORT_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

const importUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeAllowed = ALLOWED_IMPORT_MIMES.includes(file.mimetype);
    const extAllowed = ALLOWED_IMPORT_EXTENSIONS.includes(ext);

    if (mimeAllowed || extAllowed) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          `File type not allowed. Accepted formats: .xlsx, .xls, .csv`,
          400,
        ) as unknown as Error,
      );
    }
  },
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// All routes require authentication + program access
router.use(authenticate);
router.use(authorizeProgram());

// POST /import -- upload file for parsing
router.post(
  '/',
  importUpload.single('file'),
  importController.upload,
);

// POST /import/validate -- validate mapped data against program fields
router.post(
  '/validate',
  validate(validateImportSchema),
  importController.validatePreview,
);

// POST /import/execute -- execute batch import (admin/manager only)
router.post(
  '/execute',
  authorizeProgram({ roles: ['manager'] }),
  validate(executeImportSchema),
  importController.executeImport,
);

// GET /import/history -- list import history
router.get(
  '/history',
  validate(listImportHistorySchema, 'query'),
  importController.listHistory,
);

export { router as importRouter };
