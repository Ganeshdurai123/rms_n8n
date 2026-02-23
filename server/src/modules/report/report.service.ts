import mongoose from 'mongoose';
import { ReportJob, REPORT_TYPES } from './report.model.js';
import type { IReportJobDocument, ReportType } from './report.model.js';
import { Request } from '../request/request.model.js';
import { Program } from '../program/program.model.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors.js';
import type { Role } from '../../shared/types.js';

// ---------------------------------------------------------------------------
// Report Job CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new report job with status='pending'.
 * Does NOT run aggregation -- n8n does that via the internal API.
 */
export async function createReportJob(
  userId: string,
  type: ReportType,
  params?: Record<string, unknown>,
  programId?: string,
): Promise<IReportJobDocument> {
  const job = await ReportJob.create({
    type,
    status: 'pending',
    params: params ?? {},
    requestedBy: new mongoose.Types.ObjectId(userId),
    programId: programId
      ? new mongoose.Types.ObjectId(programId)
      : undefined,
  });
  return job;
}

/**
 * List reports with access scoping.
 * Admin/manager see all reports; others see only their own.
 */
export async function getReports(
  userId: string,
  userRole: Role,
  query: {
    page: number;
    limit: number;
    type?: string;
    status?: string;
  },
): Promise<{ reports: IReportJobDocument[]; total: number }> {
  const filter: Record<string, unknown> = {};

  // Access scoping: non-privileged users only see their own reports
  if (userRole !== 'admin' && userRole !== 'manager') {
    filter.requestedBy = new mongoose.Types.ObjectId(userId);
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.status) {
    filter.status = query.status;
  }

  const skip = (query.page - 1) * query.limit;

  const [reports, total] = await Promise.all([
    ReportJob.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .populate('requestedBy', 'firstName lastName email')
      .populate('programId', 'name')
      .lean() as Promise<IReportJobDocument[]>,
    ReportJob.countDocuments(filter),
  ]);

  return { reports, total };
}

/**
 * Get a single report by ID with access scoping.
 * Admin/manager can view any report; others can only view their own.
 */
export async function getReportById(
  reportId: string,
  userId: string,
  userRole: Role,
): Promise<IReportJobDocument> {
  const report = await ReportJob.findById(reportId)
    .populate('requestedBy', 'firstName lastName email')
    .populate('programId', 'name')
    .lean() as IReportJobDocument | null;

  if (!report) {
    throw new NotFoundError('Report not found');
  }

  // Access scoping
  if (
    userRole !== 'admin' &&
    userRole !== 'manager' &&
    report.requestedBy.toString() !== userId
  ) {
    throw new ForbiddenError('You do not have access to this report');
  }

  return report;
}

// ---------------------------------------------------------------------------
// Aggregation Functions (called by internal API for n8n)
// ---------------------------------------------------------------------------

/**
 * Summary report: request counts by status, by program, and by month.
 * Applies optional date range filter from params.
 */
export async function generateSummaryReport(
  params: Record<string, unknown>,
): Promise<{
  byStatus: { status: string; count: number }[];
  byProgram: { programId: string; programName: string; count: number }[];
  byMonth: { month: string; count: number }[];
}> {
  const dateFilter: Record<string, unknown> = {};

  if (params.startDate) {
    dateFilter.$gte = new Date(params.startDate as string);
  }
  if (params.endDate) {
    dateFilter.$lte = new Date(params.endDate as string);
  }

  const matchStage: Record<string, unknown> =
    Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

  // Group by status
  const byStatus = await Request.aggregate([
    { $match: matchStage },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { _id: 0, status: '$_id', count: 1 } },
    { $sort: { status: 1 } },
  ]);

  // Group by program (populate program name)
  const byProgramRaw = await Request.aggregate([
    { $match: matchStage },
    { $group: { _id: '$programId', count: { $sum: 1 } } },
    {
      $lookup: {
        from: 'programs',
        localField: '_id',
        foreignField: '_id',
        as: 'program',
      },
    },
    { $unwind: { path: '$program', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        programId: { $toString: '$_id' },
        programName: { $ifNull: ['$program.name', 'Unknown'] },
        count: 1,
      },
    },
    { $sort: { count: -1 } },
  ]);

  // Group by month
  const byMonth = await Request.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        month: {
          $concat: [
            { $toString: '$_id.year' },
            '-',
            {
              $cond: {
                if: { $lt: ['$_id.month', 10] },
                then: { $concat: ['0', { $toString: '$_id.month' }] },
                else: { $toString: '$_id.month' },
              },
            },
          ],
        },
        count: 1,
      },
    },
    { $sort: { month: 1 } },
  ]);

  return { byStatus, byProgram: byProgramRaw, byMonth };
}

/**
 * Program-level report: status breakdown, field value distributions, avg lifecycle.
 */
export async function generateProgramReport(
  programId: string,
  params: Record<string, unknown>,
): Promise<{
  statusBreakdown: { status: string; count: number }[];
  fieldDistributions: {
    fieldKey: string;
    fieldLabel: string;
    values: { value: string; count: number }[];
  }[];
  avgLifecycleDays: number | null;
}> {
  const programOid = new mongoose.Types.ObjectId(programId);

  const dateFilter: Record<string, unknown> = {};
  if (params.startDate) {
    dateFilter.$gte = new Date(params.startDate as string);
  }
  if (params.endDate) {
    dateFilter.$lte = new Date(params.endDate as string);
  }

  const matchStage: Record<string, unknown> = { programId: programOid };
  if (Object.keys(dateFilter).length > 0) {
    matchStage.createdAt = dateFilter;
  }

  // Status breakdown
  const statusBreakdown = await Request.aggregate([
    { $match: matchStage },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { _id: 0, status: '$_id', count: 1 } },
    { $sort: { status: 1 } },
  ]);

  // Field value distributions for dropdown/checkbox fields
  const program = await Program.findById(programId).lean();
  const fieldDistributions: {
    fieldKey: string;
    fieldLabel: string;
    values: { value: string; count: number }[];
  }[] = [];

  if (program) {
    const distributableFields = program.fieldDefinitions.filter(
      (fd) => fd.type === 'dropdown' || fd.type === 'checkbox',
    );

    for (const fd of distributableFields) {
      const fieldValues = await Request.aggregate([
        { $match: matchStage },
        {
          $project: {
            fieldValue: { $ifNull: [`$fields.${fd.key}`, null] },
          },
        },
        { $match: { fieldValue: { $ne: null } } },
        { $group: { _id: '$fieldValue', count: { $sum: 1 } } },
        {
          $project: {
            _id: 0,
            value: { $toString: '$_id' },
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ]);

      fieldDistributions.push({
        fieldKey: fd.key,
        fieldLabel: fd.label,
        values: fieldValues,
      });
    }
  }

  // Average lifecycle duration for completed requests
  const lifecycleResult = await Request.aggregate([
    { $match: { ...matchStage, status: 'completed', updatedAt: { $exists: true } } },
    {
      $group: {
        _id: null,
        avgMs: {
          $avg: { $subtract: ['$updatedAt', '$createdAt'] },
        },
      },
    },
  ]);

  const avgLifecycleDays =
    lifecycleResult.length > 0 && lifecycleResult[0].avgMs != null
      ? Math.round((lifecycleResult[0].avgMs / (1000 * 60 * 60 * 24)) * 100) / 100
      : null;

  return { statusBreakdown, fieldDistributions, avgLifecycleDays };
}

/**
 * Overdue report: requests past due date that are still pending action.
 */
export async function generateOverdueReport(
  params: Record<string, unknown>,
): Promise<{
  overdueRequests: {
    requestId: string;
    title: string;
    programName: string;
    status: string;
    dueDate: string;
    daysOverdue: number;
    assignedTo: { name: string; email: string } | null;
    createdBy: { name: string; email: string } | null;
  }[];
  totalOverdue: number;
}> {
  const now = new Date();

  const filter: Record<string, unknown> = {
    dueDate: { $lt: now },
    status: { $in: ['submitted', 'in_review'] },
  };

  if (params.programId) {
    filter.programId = new mongoose.Types.ObjectId(params.programId as string);
  }

  const requests = await Request.find(filter)
    .populate('createdBy', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email')
    .populate('programId', 'name')
    .sort({ dueDate: 1 })
    .lean();

  const overdueRequests = requests.map((r) => {
    const createdByUser = r.createdBy as unknown as {
      firstName?: string;
      lastName?: string;
      email?: string;
    } | null;
    const assignedToUser = r.assignedTo as unknown as {
      firstName?: string;
      lastName?: string;
      email?: string;
    } | null;
    const programDoc = r.programId as unknown as { name?: string } | null;

    const dueDateMs = r.dueDate?.getTime() ?? Date.now();
    const daysOverdue = Math.floor(
      (Date.now() - dueDateMs) / (24 * 60 * 60 * 1000),
    );

    return {
      requestId: r._id.toString(),
      title: r.title,
      programName: programDoc?.name ?? 'Unknown',
      status: r.status,
      dueDate: r.dueDate?.toISOString() ?? '',
      daysOverdue,
      assignedTo: assignedToUser
        ? {
            name: `${assignedToUser.firstName ?? ''} ${assignedToUser.lastName ?? ''}`.trim(),
            email: assignedToUser.email ?? '',
          }
        : null,
      createdBy: createdByUser
        ? {
            name: `${createdByUser.firstName ?? ''} ${createdByUser.lastName ?? ''}`.trim(),
            email: createdByUser.email ?? '',
          }
        : null,
    };
  });

  // Sort by daysOverdue descending (most overdue first)
  overdueRequests.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return { overdueRequests, totalOverdue: overdueRequests.length };
}

// ---------------------------------------------------------------------------
// Report Completion (called by internal API after n8n aggregation)
// ---------------------------------------------------------------------------

/**
 * Mark a report job as completed with its result data.
 */
export async function completeReport(
  reportId: string,
  result: Record<string, unknown>,
): Promise<IReportJobDocument> {
  const report = await ReportJob.findByIdAndUpdate(
    reportId,
    {
      status: 'completed',
      result,
      completedAt: new Date(),
    },
    { new: true },
  );

  if (!report) {
    throw new NotFoundError('Report job not found');
  }

  return report;
}

/**
 * Mark a report job as failed with an error message.
 */
export async function failReport(
  reportId: string,
  error: string,
): Promise<IReportJobDocument> {
  const report = await ReportJob.findByIdAndUpdate(
    reportId,
    {
      status: 'failed',
      error,
    },
    { new: true },
  );

  if (!report) {
    throw new NotFoundError('Report job not found');
  }

  return report;
}
