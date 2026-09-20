import { createAuthClient } from 'better-auth/react';

/** Browser-side auth: talks to /api/auth on the current origin. */
export const authClient = createAuthClient();
