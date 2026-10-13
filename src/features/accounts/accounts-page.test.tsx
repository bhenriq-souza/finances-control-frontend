import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CURRENT_USER_QUERY_KEY } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import type { Bank, BankAccount, CreditCard } from '@/api/queries/reference';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get } }));

import { activeBalanceCents, BankAccountsPage } from './bank-accounts-page';
import { BanksPage } from './banks-page';
import { cycleText, usedCents } from './card-parts';
import { CreditCardPage } from './credit-card-page';
import { CreditCardsPage } from './credit-cards-page';
import { ACCOUNT_TYPE_LABELS } from './list-parts';

const ITAU: Bank = {
    id: 'b1',
    febrabanCode: '341',
    name: 'Itaú',
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
};
const NUBANK: Bank = { ...ITAU, id: 'b2', febrabanCode: '260', name: 'Nubank' };
const OLD_BANK: Bank = {
    ...ITAU,
    id: 'b3',
    febrabanCode: '001',
    name: 'Banco do Brasil',
    archivedAt: '2026-09-01T00:00:00Z',
};

const account = (overrides: Partial<BankAccount>): BankAccount => ({
    id: 'a1',
    bank: ITAU,
    type: 'CHECKING',
    accountNumber: '12345-6',
    description: 'Conta corrente',
    openingBalanceCents: 0,
    currentBalanceCents: 0,
    overdraftLimitCents: 0,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
});

const ACCOUNTS: BankAccount[] = [
    account({
        id: 'a1',
        description: 'Poupança',
        type: 'SAVINGS',
        currentBalanceCents: 500000,
        bank: NUBANK,
    }),
    account({
        id: 'a2',
        description: 'Conta corrente',
        currentBalanceCents: -12345,
        overdraftLimitCents: 100000,
    }),
    account({
        id: 'a3',
        description: 'Antiga',
        type: 'INVESTMENT',
        currentBalanceCents: 999900,
        archivedAt: '2026-09-01T00:00:00Z',
    }),
];

const card = (overrides: Partial<CreditCard>): CreditCard => ({
    id: 'c1',
    bank: NUBANK,
    name: 'Nubank Roxinho',
    creditLimitCents: 500000,
    availableLimitCents: 350000,
    closingDay: 8,
    dueDay: 15,
    currentCycle: { startsOn: '2026-09-09', closesOn: '2026-10-08', dueOn: '2026-10-15' },
    paymentBankAccountId: 'a2',
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
});

const CARDS: CreditCard[] = [
    card({ id: 'c1' }),
    card({
        id: 'c2',
        name: 'Itaú Visa',
        bank: ITAU,
        creditLimitCents: 100000,
        availableLimitCents: -2550,
        paymentBankAccountId: null,
    }),
    card({ id: 'c3', name: 'Cartão antigo', archivedAt: '2026-09-01T00:00:00Z' }),
];

async function renderAt(node: ReactNode, seed: (client: QueryClient) => void = () => undefined) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Leitura: as listas são as mesmas para todo perfil; os controles de escrita (ADMIN) são
    // testados em `forms/`.
    client.setQueryData(CURRENT_USER_QUERY_KEY, { profile: 'VIEWER' });
    seed(client);
    const root = createRootRoute();
    const page = createRoute({ getParentRoute: () => root, path: '/', component: () => node });
    const others = [
        '/contas',
        '/contas/bancos',
        '/contas/$contaId',
        '/cartoes',
        '/cartoes/$cartaoId',
    ].map((path) =>
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
                <RouterProvider router={router} />
            </QueryClientProvider>,
        );
    });
}

const seedAll = (client: QueryClient) => {
    client.setQueryData(queryKeys.banks.all, [ITAU, NUBANK, OLD_BANK]);
    client.setQueryData(queryKeys.bankAccounts.all, ACCOUNTS);
    client.setQueryData(queryKeys.creditCards.all, CARDS);
};

const rowTexts = (table: HTMLElement) =>
    within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent ?? '');

beforeEach(() => {
    mocks.get.mockReset();
});

// AC-0011-01, INV-0011-03.
describe('BankAccountsPage', () => {
    it('lists the active accounts by description, with the type in pt-BR and the signed balance', async () => {
        await renderAt(
            <BankAccountsPage showArchived={false} onShowArchivedChange={vi.fn()} />,
            seedAll,
        );

        const table = screen.getByRole('table', { name: 'Contas bancárias' });
        const rows = rowTexts(table);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toContain('Conta corrente');
        expect(rows[0]).toContain('Itaú');
        expect(rows[0]).toContain('Corrente');
        expect(rows[0]).toContain('12345-6');
        expect(rows[0]).toContain('R$ 1.000,00');
        expect(rows[0]).toContain('−R$ 123,45');
        expect(rows[1]).toContain('Poupança');
        expect(rows[1]).toContain('R$ 5.000,00');
        expect(screen.queryByText('Antiga')).toBeNull();
    });

    // AC-0015-13: o link Extrato aparece em cada linha, também para o perfil só de leitura.
    it('links each account to its statement, even for the read-only profile', async () => {
        await renderAt(
            <BankAccountsPage showArchived={false} onShowArchivedChange={vi.fn()} />,
            seedAll,
        );

        const table = screen.getByRole('table', { name: 'Contas bancárias' });
        const links = within(table).getAllByRole('link', { name: /^Extrato de / });
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            '/contas/a2',
            '/contas/a1',
        ]);
        expect(within(table).queryByRole('button', { name: /^Editar / })).toBeNull();
    });

    it('shows Saldo em contas as the sum of the active balances only', async () => {
        await renderAt(<BankAccountsPage showArchived onShowArchivedChange={vi.fn()} />, seedAll);

        expect(activeBalanceCents(ACCOUNTS)).toBe(500000 - 12345);
        const total = screen.getByRole('region', { name: 'Saldo em contas' });
        expect(total.textContent).toContain('R$ 4.876,55');
    });

    it('adds the archived accounts with the Arquivado badge when asked to', async () => {
        const onChange = vi.fn();
        await renderAt(<BankAccountsPage showArchived onShowArchivedChange={onChange} />, seedAll);

        const table = screen.getByRole('table', { name: 'Contas bancárias' });
        const rows = rowTexts(table);
        expect(rows).toHaveLength(3);
        ['Antiga', 'Conta corrente', 'Poupança'].forEach((name, index) =>
            expect(rows[index]).toMatch(new RegExp(`^${name}`)),
        );
        expect(rows[0]).toContain('Investimento');
        expect(rows[0]).toContain('Arquivado');
        expect(rows[1]).not.toContain('Arquivado');

        const toggle = screen.getByRole('checkbox', { name: 'Mostrar arquivadas' });
        expect(toggle).toBeChecked();
        fireEvent.click(toggle);
        expect(onChange).toHaveBeenCalledWith(false);
    });

    it('links to the banks page', async () => {
        await renderAt(
            <BankAccountsPage showArchived={false} onShowArchivedChange={vi.fn()} />,
            seedAll,
        );
        expect(screen.getByRole('link', { name: 'Bancos' })).toHaveAttribute(
            'href',
            '/contas/bancos',
        );
    });

    it('maps every account type to pt-BR', () => {
        expect(ACCOUNT_TYPE_LABELS).toEqual({
            CHECKING: 'Corrente',
            SAVINGS: 'Poupança',
            INVESTMENT: 'Investimento',
        });
    });

    it('shows the empty state without accounts', async () => {
        await renderAt(
            <BankAccountsPage showArchived={false} onShowArchivedChange={vi.fn()} />,
            (client) => client.setQueryData(queryKeys.bankAccounts.all, []),
        );
        expect(screen.getByRole('heading', { name: 'Nenhuma conta bancária.' })).toBeVisible();
    });

    // ERR-0011-05 / ERR-0009-01.
    it('shows the error state with a retry when the list fails', async () => {
        mocks.get.mockResolvedValue({
            data: undefined,
            error: { error: { code: 'INTERNAL_ERROR', message: 'boom' } },
            response: new Response(null, { status: 500 }),
        });
        await renderAt(<BankAccountsPage showArchived={false} onShowArchivedChange={vi.fn()} />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar.');
        fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
        expect(mocks.get).toHaveBeenCalledTimes(2);
    });

    it('shows the skeleton while the list loads', async () => {
        mocks.get.mockReturnValue(new Promise(() => undefined));
        await renderAt(<BankAccountsPage showArchived={false} onShowArchivedChange={vi.fn()} />);
        expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument();
    });
});

describe('BanksPage', () => {
    it('lists the active banks by name with the FEBRABAN code', async () => {
        await renderAt(<BanksPage showArchived={false} onShowArchivedChange={vi.fn()} />, seedAll);

        const rows = rowTexts(screen.getByRole('table', { name: 'Bancos' }));
        expect(rows).toEqual(['341Itaú', '260Nubank']);
        expect(screen.getByRole('link', { name: 'Contas' })).toHaveAttribute('href', '/contas');
    });

    it('adds the archived banks with the badge', async () => {
        const onChange = vi.fn();
        await renderAt(<BanksPage showArchived onShowArchivedChange={onChange} />, seedAll);

        const rows = rowTexts(screen.getByRole('table', { name: 'Bancos' }));
        expect(rows[0]).toBe('001Banco do BrasilArquivado');
        fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar arquivados' }));
        expect(onChange).toHaveBeenCalledWith(false);
    });

    it('shows the empty state without banks', async () => {
        await renderAt(
            <BanksPage showArchived={false} onShowArchivedChange={vi.fn()} />,
            (client) => client.setQueryData(queryKeys.banks.all, []),
        );
        expect(screen.getByRole('heading', { name: 'Nenhum banco.' })).toBeVisible();
    });
});

// AC-0011-02, INV-0011-03.
describe('CreditCardsPage', () => {
    it('shows used, available and the cycle of each active card, linking to its summary', async () => {
        await renderAt(
            <CreditCardsPage showArchived={false} onShowArchivedChange={vi.fn()} />,
            seedAll,
        );

        const table = screen.getByRole('table', { name: 'Cartões de crédito' });
        const rows = within(table).getAllByRole('row').slice(1);
        expect(rows).toHaveLength(2);

        const itau = rows[0]!;
        expect(itau.textContent).toContain('Itaú Visa');
        expect(itau.textContent).toContain('R$ 1.025,50');
        expect(itau.textContent).toContain('—');
        const overdrawn = within(itau).getByText('−R$ 25,50');
        expect(overdrawn).toHaveClass('text-negativo');
        expect(within(itau).getByRole('link')).toHaveAttribute('href', '/cartoes/c2');

        const nubank = rows[1]!;
        expect(nubank.textContent).toContain('Fecha em 8 out. · vence em 15 out.');
        expect(nubank.textContent).toContain('Conta corrente');
        expect(within(nubank).getByText('R$ 3.500,00')).not.toHaveClass('text-negativo');
        expect(within(nubank).getByText('R$ 1.500,00')).toBeInTheDocument();
    });

    it('subtracts the available limit from the credit limit', () => {
        expect(usedCents(CARDS[0]!)).toBe(150000);
        expect(usedCents(CARDS[1]!)).toBe(102550);
        expect(cycleText(CARDS[0]!)).toBe('Fecha em 8 out. · vence em 15 out.');
    });

    it('draws the usage bar proportional to the limit, capped at full', async () => {
        await renderAt(
            <CreditCardsPage showArchived={false} onShowArchivedChange={vi.fn()} />,
            seedAll,
        );
        const table = screen.getByRole('table', { name: 'Cartões de crédito' });
        const bars = table.querySelectorAll<HTMLElement>('[data-slot="bar"]');
        expect([...bars].map((bar) => bar.style.width)).toEqual(['100%', '30%']);
    });

    it('adds the archived cards with the badge', async () => {
        await renderAt(<CreditCardsPage showArchived onShowArchivedChange={vi.fn()} />, seedAll);
        const rows = rowTexts(screen.getByRole('table', { name: 'Cartões de crédito' }));
        expect(rows).toHaveLength(3);
        expect(rows[0]).toContain('Cartão antigo');
        expect(rows[0]).toContain('Arquivado');
    });

    it('shows the empty state without cards', async () => {
        await renderAt(
            <CreditCardsPage showArchived={false} onShowArchivedChange={vi.fn()} />,
            (client) => client.setQueryData(queryKeys.creditCards.all, []),
        );
        expect(screen.getByRole('heading', { name: 'Nenhum cartão de crédito.' })).toBeVisible();
    });
});

describe('CreditCardPage', () => {
    it('shows the card summary with the total limit and the paying account', async () => {
        await renderAt(<CreditCardPage cardId="c1" />, seedAll);

        expect(screen.getByRole('heading', { name: 'Nubank Roxinho', level: 1 })).toBeVisible();
        const details = document.querySelector('dl')!;
        expect(details.textContent).toContain('Limite total');
        expect(details.textContent).toContain('R$ 5.000,00');
        expect(details.textContent).toContain('R$ 1.500,00');
        expect(details.textContent).toContain('Fecha em 8 out. · vence em 15 out.');
        expect(details.textContent).toContain('Conta corrente');
        expect(screen.getByText('R$ 3.500,00')).toBeVisible();
        expect(screen.getByRole('link', { name: 'Cartões' })).toHaveAttribute('href', '/cartoes');
    });

    it('shows an archived card with its badge', async () => {
        await renderAt(<CreditCardPage cardId="c3" />, seedAll);
        expect(screen.getByText('Arquivado')).toBeVisible();
    });

    it('shows an overdrawn card in the negative tone', async () => {
        await renderAt(<CreditCardPage cardId="c2" />, seedAll);
        expect(screen.getByText('−R$ 25,50')).toHaveClass('text-negativo');
        expect(screen.getByText('—')).toBeVisible();
    });

    // ERR-0011-03 / ERR-0009-02.
    it('shows not found for an unknown card, linking back to the list', async () => {
        await renderAt(<CreditCardPage cardId="desconhecido" />, seedAll);

        expect(screen.getByRole('heading', { name: 'Não encontramos este item.' })).toBeVisible();
        expect(screen.getByRole('link', { name: 'Voltar para os cartões' })).toHaveAttribute(
            'href',
            '/cartoes',
        );
    });
});
