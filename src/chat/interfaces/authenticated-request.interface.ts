import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  username?: string;
  roles?: string[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
