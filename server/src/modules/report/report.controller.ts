import type { Request, Response, NextFunction } from 'express';
import { createReportJob, getReports, getReportById } from './report.service.js';
import { enqueueWebhookEvent } from '../webhook/webhook.service.js';
import { paginatedResponse } from '../../middleware/pagination.js';
import type { CreateReportBody, ListReportsQuery, ReportIdParams } from './report.schema.js';
import type { WebhookPayload } from '../webhook/webhook.types.js';
import type { IUser } from '../../shared/types.js';

// ---------------------------------------------------------------------------
// Generate Report (POST /)
// ---------------------------------------------------------------------------

/**
 * Create a pending report job and enqueue a webhook event for n8n.
 * Returns 202 Accepted with the job ID.
 */
export const generateReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = req.user as IUser;
    const { type, programId, params } = req.body as CreateReportBody;

    const job = await createReportJob(
      user._id.toString(),
      type,
      params as Record<string, unknown> | undefined,
      programId,
    );

    // Fire-and-forget: enqueue webhook for n8n async processing
    const webhookPayload: WebhookPayload = {
      eventType: 'report.requested',
      programId: programId ?? '',
      requestId: job._id.toString(),
      data: {
        reportId: job._id.toString(),
        type,
        params: params ?? {},
        programId: programId ?? undefined,
      },
      performedBy: {
        userId: user._id.toString(),
        name: `${user.firstName} ${user.lastName}`,
      },
      timestamp: new Date().toISOString(),
    };

    enqueueWebhookEvent('report.requested', webhookPayload).catch(() => {
      // fire-and-forget -- error already logged in webhook service
    });

    res.status(202).json({
      reportId: job._id.toString(),
      status: 'pending',
      message: 'Report generation started',
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// List Reports (GET /)
// ---------------------------------------------------------------------------

/**
 * List reports for the current user with pagination and filters.
 */
export const listReports = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = req.user as IUser;
    const query = req.query as unknown as ListReportsQuery;

    const { reports, total } = await getReports(
      user._id.toString(),
      user.role,
      {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        type: query.type,
        status: query.status,
      },
    );

    res.json(
      paginatedResponse(
        reports,
        total,
        query.page ?? 1,
        query.limit ?? 20,
      ),
    );
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Get Report (GET /:reportId)
// ---------------------------------------------------------------------------

/**
 * Get a single report by ID (includes result if completed).
 */
export const getReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = req.user as IUser;
    const { reportId } = req.params as unknown as ReportIdParams;

    const report = await getReportById(
      reportId,
      user._id.toString(),
      user.role,
    );

    res.json({ data: report });
  } catch (error) {
    next(error);
  }
};
