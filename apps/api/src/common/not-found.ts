import { NotFoundException } from '@nestjs/common';

/** Used for both "doesn't exist" and "not in your workspace", so ids from other workspaces reveal nothing. */
export const notFound = (what: string) => new NotFoundException({ code: 'NOT_FOUND', message: `${what} not found.` });
