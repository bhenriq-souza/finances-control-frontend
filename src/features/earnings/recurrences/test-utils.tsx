import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render } from '@testing-library/react';
import { useState, type ReactNode } from 'react';

import { CURRENT_USER_QUERY_KEY, type CurrentUser, type Profile } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import type { BankAccount, EarningType } from '@/api/queries/reference';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import type { Earning } from '../list/earning-model';

import type { EarningRecurrence } from './api';

// Só para testes: dados e montagem das telas de séries de receita.

export const SERIES_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const OTHER_SERIES_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
export const TYPE_ID = '33333333-3333-4333-8333-333333333333';

const CREATED = '2026-01-01T00:00:00Z';
const BANK = {
    id: '99999999-9999-4999-8999-999999999999',
    febrabanCode: '260',
    name: 'Nu Pagamentos',
    archivedAt: null,
    createdAt: CREATED,
};

export const TYPES: EarningType[] = [
    { id: TYPE_ID, name: 'Salário', archivedAt: null, createdAt: CREATED },
];

export const ACCOUNTS: BankAccount[] = [
    {
        id: ACCOUNT_ID,
        bank: BANK,
        type: 'CHECKING',
        accountNumber: '12345-6',
        description: 'Conta corrente',
        openingBalanceCents: 0,
        currentBalanceCents: 0,
        overdraftLimitCents: 0,
        archivedAt: null,
        createdAt: CREATED,
    },
];

export function recurrence(overrides: Partial<EarningRecurrence> = {}): EarningRecurrence {
    return {
        id: SERIES_ID,
        description: 'Salário',
        typeId: TYPE_ID,
        amountCents: 500000,
        dayOfMonth: 5,
        bankAccountId: ACCOUNT_ID,
        startsOn: '2026-08-05',
        endsOn: null,
        nextOccurrenceOn: '2026-11-05',
        createdAt: CREATED,
        updatedAt: CREATED,
        ...overrides,
    };
}

export function occurrence(overrides: Partial<Earning> & Pick<Earning, 'id'>): Earning {
    return {
        description: 'Salário',
        kind: 'FIXED',
        status: 'FORECAST',
        amountCents: 500000,
        occurredOn: '2026-10-05',
        receivedOn: null,
        notes: null,
        earningType: TYPES[0]!,
        bankAccountId: ACCOUNT_ID,
        installment: null,
        recurrenceId: SERIES_ID,
        createdAt: CREATED,
        updatedAt: CREATED,
        ...overrides,
    };
}

function user(profile: Profile): CurrentUser {
    return {
        id: 'id',
        email: 'ana@example.com',
        emailVerified: true,
        name: 'Ana Souza',
        profile,
        profileGrantedAt: null,
        avatarUpdatedAt: null,
        createdAt: '2026-10-01T00:00:00Z',
    };
}

/** Resposta de sucesso do cliente gerado. */
export function ok(data: unknown, status = 200) {
    return { data: { data }, response: { ok: true, status } };
}

/** Resposta de erro do cliente gerado, com o corpo `Error` do contrato. */
export function fail(status: number, code: string, details?: unknown) {
    return {
        error: { error: { code, message: 'raw message', details } },
        response: { ok: false, status },
    };
}

/**
 * Monta uma tela com o cache (usuário atual, contas e tipos), os avisos e um roteador em
 * memória; os parâmetros de busca ficam num estado local, como a rota faria.
 */
export async function renderWithSearch<S extends object>(
    initial: S,
    page: (search: S, onSearchChange: (next: Partial<S>) => void) => ReactNode,
    { profile = 'ADMIN' as Profile } = {},
) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user(profile));
    queryClient.setQueryData(queryKeys.bankAccounts.all, ACCOUNTS);
    queryClient.setQueryData(queryKeys.earningTypes.all, TYPES);

    function Harness() {
        const [search, setSearch] = useState(initial);
        return page(search, (next) => setSearch((previous) => ({ ...previous, ...next })));
    }

    const router = createRouter({
        routeTree: createRootRoute({ component: Harness }),
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
