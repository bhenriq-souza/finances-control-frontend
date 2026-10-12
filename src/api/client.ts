import createClient from 'openapi-fetch';

import { authMiddleware } from './auth';
import type { paths } from './generated/schema';

export const api = createClient<paths>({ baseUrl: '/api' });

api.use(authMiddleware);
