import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render } from '@testing-library/react';
import { useState } from 'react';

import { CURRENT_USER_QUERY_KEY, type CurrentUser } from '@/api/queries/current-user';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import type { PlatformUser } from './users-api';
import { UsersPage, type UsersFilter } from './users-page';

/** Só para testes: um usuário da plataforma. */
export function platformUser(overrides: Partial<PlatformUser> & { id: string }): PlatformUser {
    return {
        email: `${overrides.id}@example.com`,
        emailVerified: true,
        name: overrides.id,
        profile: null,
        profileGrantedAt: null,
        createdAt: '2026-10-01T12:00:00Z',
        ...overrides,
    };
}

export const ADMIN_ME = platformUser({
    id: 'ana',
    name: 'Ana Souza',
    profile: 'ADMIN',
    profileGrantedAt: '2026-10-01T12:00:00Z',
});

/** Corpo `200` de uma resposta do cliente gerado. */
export const ok = (body: unknown, status = 200) => ({
    data: body,
    response: new Response(null, { status }),
});

/** Corpo de erro do contrato. */
export const fail = (status: number, code: string) => ({
    error: { error: { code, message: 'x' } },
    response: new Response(null, { status }),
});

function Harness({ initialProfileUserId }: { initialProfileUserId?: string }) {
    const [filter, setFilter] = useState<UsersFilter>('todos');
    const [profileUserId, setProfileUserId] = useState(initialProfileUserId);
    return (
        <UsersPage
            filter={filter}
            profileUserId={profileUserId}
            onFilterChange={setFilter}
            onProfileUserChange={setProfileUserId}
        />
    );
}

/** Só para testes: `/usuarios` com o usuário atual no cache, avisos e um roteador em memória. */
export async function renderUsersPage(
    me: CurrentUser = ADMIN_ME,
    options: { profileUserId?: string } = {},
) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, me);
    const router = createRouter({
        routeTree: createRootRoute({
            component: () => <Harness initialProfileUserId={options.profileUserId} />,
        }),
        history: createMemoryHistory(),
    });
    await router.load();
    await act(async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <NoticeProvider store={createNoticeStore()}>
                    <RouterProvider router={router} />
                </NoticeProvider>
            </QueryClientProvider>,
        );
    });
    return { queryClient };
}
