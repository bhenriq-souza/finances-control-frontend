import type { QueryClient } from '@tanstack/react-query';

import type { AuthSession } from '@/features/identity';

/** Contexto do roteador: a guarda usa o cache de consultas e a sessão (spec 0006). */
export interface RouterContext {
    queryClient: QueryClient;
    auth: AuthSession;
}
