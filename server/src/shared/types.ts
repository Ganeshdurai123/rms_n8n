export type Role = 'admin' | 'manager' | 'team_member' | 'client';

export type ProgramRole = 'manager' | 'team_member' | 'client';

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

export interface IProgramMembership {
  userId: string;
  programId: string;
  role: ProgramRole;
}

// Extend Express Request to include user and program membership
declare global {
  namespace Express {
    interface User extends IUser {}
    interface Request {
      programMembership?: IProgramMembership;
    }
  }
}
