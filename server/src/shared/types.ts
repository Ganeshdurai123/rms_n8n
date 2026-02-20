export type Role = 'admin' | 'manager' | 'team_member' | 'client';

export interface IUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface User extends IUser {}
  }
}
