export type Role = 'admin' | 'manager' | 'team_member' | 'client';
export type ProgramRole = 'manager' | 'team_member' | 'client';
export type RequestStatus = 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'completed';
export type RequestPriority = 'low' | 'medium' | 'high' | 'urgent';
export type FieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'checklist' | 'file_upload';

export type ChecklistItem = { label: string; checked: boolean };

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  items?: string[];
  placeholder?: string;
  order: number;
}

export interface Program {
  _id: string;
  name: string;
  description?: string;
  fieldDefinitions: FieldDefinition[];
  settings: {
    allowClientSubmission: boolean;
    requireApproval: boolean;
    maxActiveRequests?: number;
    maxActiveRequestsPerUser?: number;
  };
  timeframes: {
    startDate?: string;
    endDate?: string;
  };
  dueDateConfig?: {
    enabled: boolean;
    defaultOffsetDays: number;
    dueDateField?: string;
  };
  complianceType?: 'hssp' | null;
  status: 'active' | 'archived';
  createdBy: string | { _id: string; firstName: string; lastName: string };
}

export interface RequestItem {
  _id: string;
  programId: string | { _id: string; name: string };
  title: string;
  description?: string;
  status: RequestStatus;
  fields: Record<string, unknown>;
  createdBy: string | { _id: string; firstName: string; lastName: string; email: string };
  assignedTo?: string | { _id: string; firstName: string; lastName: string; email: string } | null;
  priority: RequestPriority;
  dueDate?: string;
  chainId?: string | { _id: string; name: string };
  chainSequence?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ---------- Chain Types ----------

export interface ChainStep {
  requestId: string | { _id: string; title: string; status: RequestStatus };
  sequence: number;
}

export interface RequestChain {
  _id: string;
  name: string;
  programId: string;
  steps: ChainStep[];
  status: 'active' | 'completed';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Request Detail Types ----------

export interface Comment {
  _id: string;
  requestId: string;
  authorId: string | { _id: string; firstName: string; lastName: string; email: string };
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  _id: string;
  requestId: string;
  uploadedBy: string | { _id: string; firstName: string; lastName: string; email: string };
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface AuditEntry {
  _id: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string;
  programId: string;
  performedBy: string | { _id: string; firstName: string; lastName: string; email: string };
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: string;
}

export interface RequestDetail {
  request: RequestItem & {
    programId: { _id: string; name: string; fieldDefinitions: FieldDefinition[] };
  };
  comments: Comment[];
  attachments: Attachment[];
  auditTrail: AuditEntry[];
  chain: RequestChain | null;
}

// ---------- Import Types ----------

export interface ImportUploadResult {
  importJobId: string;
  columns: string[];
  sampleRows: Record<string, unknown>[];
  totalRows: number;
}

export interface ImportValidationResult {
  importJobId: string;
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: Array<{ row: number; field: string; message: string }>;
  validRows: Array<{ title: string; description?: string; fields: Record<string, unknown> }>;
}

export interface ImportExecuteResult {
  importJobId: string;
  successCount: number;
  errorCount: number;
  totalRows: number;
}

export interface ImportJob {
  _id: string;
  programId: string;
  performedBy: string | { _id: string; firstName: string; lastName: string; email: string };
  originalFilename: string;
  status: 'pending' | 'validated' | 'completed' | 'failed';
  totalRows: number;
  successCount: number;
  errorCount: number;
  createdAt: string;
}

// ---------- Report Types ----------
export type ReportType = 'summary' | 'program' | 'overdue';
export type ReportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ReportJob {
  _id: string;
  type: ReportType;
  status: ReportStatus;
  params?: { startDate?: string; endDate?: string; programId?: string };
  result?: SummaryReportResult | ProgramReportResult | OverdueReportResult | null;
  requestedBy: string | { _id: string; firstName: string; lastName: string };
  programId?: string | { _id: string; name: string };
  error?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SummaryReportResult {
  byStatus: Array<{ status: string; count: number }>;
  byProgram: Array<{ programId: string; programName: string; count: number }>;
  byMonth: Array<{ month: string; count: number }>;
}

export interface ProgramReportResult {
  statusBreakdown: Array<{ status: string; count: number }>;
  fieldDistributions: Array<{ fieldKey: string; fieldLabel: string; values: Array<{ value: string; count: number }> }>;
  avgLifecycleDays: number | null;
}

export interface OverdueReportResult {
  overdueRequests: Array<{
    requestId: string;
    title: string;
    programName: string;
    status: string;
    dueDate: string;
    daysOverdue: number;
    assignedTo: { name: string; email: string } | null;
    createdBy: { name: string; email: string };
  }>;
  totalOverdue: number;
}

// ---------- Boundary Stats Types ----------

export interface BoundaryStats {
  programId: string;
  programName: string;
  limits: {
    maxActiveRequests: number | null;
    maxActiveRequestsPerUser: number | null;
  };
  usage: {
    totalActiveRequests: number;
    perUser: Array<{
      userId: string;
      name: string;
      email: string | null;
      activeCount: number;
    }>;
  };
}

// ---------- Notification Types ----------

export type NotificationType =
  | 'request.status_changed'
  | 'request.assigned'
  | 'request.created'
  | 'request.updated'
  | 'comment.added'
  | 'attachment.uploaded'
  | 'reminder';

export interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  programId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
