import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError } from '../shared/errors.js';
import logger from '../config/logger.js';

interface ErrorResponse {
  status: 'error';
  message: string;
  errors?: Array<{ path: string; message: string }>;
  stack?: string;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error(err);

  const response: ErrorResponse = {
    status: 'error',
    message: 'Internal server error',
  };

  let statusCode = 500;

  // Handle AppError (custom operational errors)
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    response.message = err.message;
  }
  // Handle Zod validation errors
  else if (err instanceof ZodError) {
    statusCode = 400;
    response.message = 'Validation failed';
    response.errors = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  }
  // Handle Mongoose validation errors
  else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    response.message = 'Validation failed';
    response.errors = Object.entries(err.errors).map(([path, error]) => ({
      path,
      message: error.message,
    }));
  }
  // Handle Mongoose cast errors (invalid ObjectId, etc.)
  else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    response.message = `Invalid ${err.path}: ${err.value}`;
  }
  // Generic error
  else {
    response.message =
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;
  }

  // Include stack trace in development only
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
