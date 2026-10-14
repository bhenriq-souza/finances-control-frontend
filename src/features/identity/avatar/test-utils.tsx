import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';

import { CURRENT_USER_QUERY_KEY, type CurrentUser } from '@/api/queries/current-user';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

/** Só para testes: o usuário atual, sem foto. */
export function currentUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
    return {
        id: 'ana',
        email: 'ana@example.com',
        emailVerified: true,
        name: 'Ana Souza',
        profile: 'ADMIN',
        profileGrantedAt: '2026-10-01T12:00:00Z',
        avatarUpdatedAt: null,
        createdAt: '2026-10-01T12:00:00Z',
        ...overrides,
    };
}

/** Resposta de sucesso do cliente gerado. */
export const ok = (data: unknown, status = 200) => ({
    data,
    response: new Response(null, { status }),
});

/** Corpo de erro do contrato. */
export const fail = (status: number, code: string) => ({
    error: { error: { code, message: 'x' } },
    response: new Response(null, { status }),
});

/** `URL.createObjectURL`/`revokeObjectURL`, que o jsdom não tem, com URLs numeradas. */
export function stubObjectUrls() {
    let next = 0;
    const create = vi.fn((_blob: Blob) => `blob:foto-${++next}`);
    const revoke = vi.fn((_url: string) => undefined);
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    return { create, revoke };
}

/** Só para testes: monta o elemento com o cache (com o usuário atual) e os avisos. */
export async function renderWithUser(element: ReactElement, user: CurrentUser = currentUser()) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user);
    const notices = createNoticeStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <NoticeProvider store={notices}>{children}</NoticeProvider>
        </QueryClientProvider>
    );
    const result = render(element, { wrapper });
    // Deixa as consultas e efeitos da montagem assentarem.
    await act(async () => {});
    return { queryClient, notices, ...result };
}
