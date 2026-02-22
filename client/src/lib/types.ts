export type Role = 'admin' | 'manager' | 'team_member' | 'client';
export type ProgramRole = 'manager' | 'team_member' | 'client';
export type RequestStatus = 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'completed';
export type RequestPriority = 'low' | 'medium' | 'high' | 'urgent';
export type FieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'file_upload';

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
}

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
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
  };
  timeframes: {
    startDate?: string;
    endDate?: string;
  };
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
