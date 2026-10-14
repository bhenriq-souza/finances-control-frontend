import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect } from 'vitest';

import { CURRENT_USER_QUERY_KEY, type CurrentUser, type Profile } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import type { Bank, BankAccount, CreditCard } from '@/api/queries/reference';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

// Só para testes: dados e montagem das telas e formulários de cadastro (spec 0011).

export const ITAU: Bank = {
    id: 'b-itau',
    febrabanCode: '341',
    name: 'Itaú',
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
};
export const NUBANK: Bank = { ...ITAU, id: 'b-nubank', febrabanCode: '260', name: 'Nubank' };
export const OLD_BANK: Bank = {
    ...ITAU,
    id: 'b-bb',
    febrabanCode: '001',
    name: 'Banco do Brasil',
    archivedAt: '2026-09-01T00:00:00Z',
};
export const BANKS: Bank[] = [ITAU, NUBANK, OLD_BANK];

export const CORRENTE: BankAccount = {
    id: 'a-corrente',
    bank: ITAU,
    type: 'CHECKING',
    accountNumber: '12345-6',
    description: 'Conta corrente',
    openingBalanceCents: 100000,
    currentBalanceCents: -12345,
    overdraftLimitCents: 100000,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
};
export const POUPANCA: BankAccount = {
    ...CORRENTE,
    id: 'a-poupanca',
    bank: NUBANK,
    type: 'SAVINGS',
    accountNumber: '98765-4',
    description: 'Poupança',
    overdraftLimitCents: 0,
};
export const ANTIGA: BankAccount = {
    ...CORRENTE,
    id: 'a-antiga',
    bank: OLD_BANK,
    accountNumber: '55555-0',
    description: 'Conta antiga',
    archivedAt: '2026-09-01T00:00:00Z',
};
export const ACCOUNTS: BankAccount[] = [CORRENTE, POUPANCA, ANTIGA];

export const ROXINHO: CreditCard = {
    id: 'c-roxinho',
    bank: NUBANK,
    name: 'Nubank Roxinho',
    creditLimitCents: 500000,
    availableLimitCents: 350000,
    closingDay: 8,
    dueDay: 15,
    currentCycle: { startsOn: '2026-09-09', closesOn: '2026-10-08', dueOn: '2026-10-15' },
    paymentBankAccountId: CORRENTE.id,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
};
export const CARTAO_ANTIGO: CreditCard = {
    ...ROXINHO,
    id: 'c-antigo',
    name: 'Cartão antigo',
    paymentBankAccountId: ANTIGA.id,
    archivedAt: '2026-09-01T00:00:00Z',
};
export const CARDS: CreditCard[] = [ROXINHO, CARTAO_ANTIGO];

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
export const ok = (body: unknown = { data: {} }, status = 200) => ({
    data: body,
    response: new Response(null, { status }),
});

/** Resposta de erro do cliente gerado, no schema `Error` do contrato. */
export const fail = (status: number, code: string, details?: unknown) => ({
    error: { error: { code, message: 'raw', details } },
    response: new Response(null, { status }),
});

/** Monta `node` com cache semeado (usuário, bancos, contas, cartões), avisos e roteador. */
export async function renderWithApp(node: ReactNode, profile: Profile = 'ADMIN') {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(CURRENT_USER_QUERY_KEY, user(profile));
    client.setQueryData(queryKeys.banks.all, BANKS);
    client.setQueryData(queryKeys.bankAccounts.all, ACCOUNTS);
    client.setQueryData(queryKeys.creditCards.all, CARDS);
    const root = createRootRoute();
    const page = createRoute({ getParentRoute: () => root, path: '/', component: () => node });
    const others = ['/contas', '/contas/bancos', '/cartoes', '/cartoes/$cartaoId'].map((path) =>
        createRoute({ getParentRoute: () => root, path, component: () => <p>outra</p> }),
    );
    const router = createRouter({
        routeTree: root.addChildren([page, ...others]),
        history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    await router.load();
    await act(async () => {
        render(
            <QueryClientProvider client={client}>
                <NoticeProvider store={createNoticeStore()}>
                    <RouterProvider router={router} />
                </NoticeProvider>
            </QueryClientProvider>,
        );
    });
    return { client };
}

/** A região de avisos globais. */
export const notices = () => screen.getByRole('region', { name: 'Avisos' });

/** Espera o campo ficar inválido com a mensagem dada. */
export async function expectFieldError(field: HTMLElement, message: string) {
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
    expect(field).toHaveAccessibleDescription(expect.stringContaining(message));
}
