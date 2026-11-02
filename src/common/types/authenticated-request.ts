import type { Request } from 'express';
export type Principal = { id: number; role: 'USER' | 'ADMIN' };
export interface AuthenticatedRequest extends Request {
  user: Principal;
}
