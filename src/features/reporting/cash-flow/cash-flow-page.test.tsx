import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ GET: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks }));

import { queryKeys } from '@/api/queries/keys';
import type { CreditCard } from '@/api/queries/reference';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import { CashFlowPage, type CashFlowRowActions } from './cash-flow-page';
import type { BalanceReport } from './cash-flow-model';
import type { CashFlowSearch } from './search';
import {
    ACCOUNT,
    ACCOUNT_ID,
    OTHER_ACCOUNT,
    OTHER_ACCOUNT_ID,
    TRANSFER_IN_LATE,
    TRANSFER_OUT,
    TRANSFER_OUT_LATER,
    ARCHIVED_CARD_ID,
    card,
    CARD_EXPENSE,
    CLOSED_TO_PAY,
    FREELA,
    INTERNET,
    LATE_EARNING,
    PAID_SEPTEMBER,
    PHARMACY,
    point,
    PROJECTED,
    RENT,
    SALARY,
    SEPTEMBER_OVERDUE,
    TODAY,
} from './test-data';

const ok = (data: unknown) => ({ data: { data }, response: { ok: true, status: 200 } });
const fail = (status: number, code: string) => ({
    error: { error: { code, message: 'raw' } },
    response: { ok: false, status },
});

const BALANCE: BalanceReport = {
    from: '2026-09',
    to: '2026-10',
    points: [point('2026-09', 'REALIZED', 487655), point('2026-10', 'FORECAST', 612345, 102550)],
};

const OTHER_CARD_ID = '33333333-3333-4333-8333-333333333335';
/** O cartão pago pela poupança, com uma fatura que vence em outubro. */
const OTHER_CARD = card({
    id: OTHER_CARD_ID,
    name: 'Nubank',
    paymentBankAccountId: OTHER_ACCOUNT_ID,
});
const OTHER_STATEMENT = {
    ...CLOSED_TO_PAY,
    id: 's5',
    creditCardId: OTHER_CARD_ID,
    dueOn: '2026-10-10',
};

interface Overrides {
    earnings?: unknown;
    expenses?: unknown;
    balance?: unknown;
    statementsFail?: boolean;
    balanceFail?: boolean;
    accountNotFound?: boolean;
}

/** As listas como o backend: com `bankAccountId`, só as da conta. */
const ofAccount = <T extends { bankAccountId: string | null }>(
    list: readonly T[],
    query: Record<string, string>,
) => list.filter((item) => !query.bankAccountId || item.bankAccountId === query.bankAccountId);

/** Saldo da conta corrente: só os números dela. */
const ACCOUNT_BALANCE: BalanceReport = {
    from: '2026-09',
    to: '2026-10',
    points: [point('2026-09', 'REALIZED', 200000), point('2026-10', 'FORECAST', 300000, 102550)],
};

function routeApi(overrides: Overrides = {}) {
    mocks.GET.mockImplementation(
        (path: string, init: { params?: { query?: Record<string, string> } }) => {
            const query = init.params?.query ?? {};
            switch (path) {
                case '/earnings':
                    return Promise.resolve(
                        ok(
                            ofAccount(
                                query.status === 'OVERDUE'
                                    ? [LATE_EARNING]
                                    : ((overrides.earnings as (typeof SALARY)[] | undefined) ?? [
                                          FREELA,
                                          SALARY,
                                          LATE_EARNING,
                                      ]),
                                query,
                            ),
                        ),
                    );
                case '/expenses':
                    return Promise.resolve(
                        ok(
                            ofAccount(
                                query.status === 'OVERDUE'
                                    ? [SEPTEMBER_OVERDUE, PHARMACY]
                                    : ((overrides.expenses as (typeof RENT)[] | undefined) ?? [
                                          INTERNET,
                                          CARD_EXPENSE,
                                          RENT,
                                          PHARMACY,
                                      ]),
                                query,
                            ),
                        ),
                    );
                case '/bank-transfers':
                    return Promise.resolve(
                        ok(
                            query.status === 'SCHEDULED'
                                ? [{ ...TRANSFER_IN_LATE, id: 't0', occurredOn: '2026-09-20' }]
                                : [TRANSFER_OUT, TRANSFER_IN_LATE, TRANSFER_OUT_LATER],
                        ),
                    );
                case '/statements':
                    if (overrides.statementsFail) {
                        return Promise.resolve(fail(500, 'INTERNAL_ERROR'));
                    }
                    if (query.creditCardId === OTHER_CARD_ID) {
                        return Promise.resolve(ok([OTHER_STATEMENT]));
                    }
                    return Promise.resolve(ok([PAID_SEPTEMBER, CLOSED_TO_PAY, PROJECTED]));
                case '/reports/balance':
                    if (overrides.balanceFail) return Promise.resolve(fail(500, 'INTERNAL_ERROR'));
                    if (query.bankAccountId) {
                        return Promise.resolve(
                            overrides.accountNotFound
                                ? fail(404, 'BANK_ACCOUNT_NOT_FOUND')
                                : ok(ACCOUNT_BALANCE),
                        );
                    }
                    return Promise.resolve(ok(overrides.balance ?? BALANCE));
                default:
                    return Promise.resolve(fail(404, 'ROUTE_NOT_FOUND'));
            }
        },
    );
}

async function renderPage(
    initial: CashFlowSearch,
    rowActions?: CashFlowRowActions,
    extraCards: readonly CreditCard[] = [],
) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(queryKeys.bankAccounts.all, [ACCOUNT, OTHER_ACCOUNT]);
    queryClient.setQueryData(queryKeys.creditCards.all, [
        card(),
        ...extraCards,
        card({ id: ARCHIVED_CARD_ID, name: 'Antigo', archivedAt: '2026-09-01T00:00:00Z' }),
    ]);
    const notices = createNoticeStore();
    const searches: CashFlowSearch[] = [];
    const replaced: boolean[] = [];

    function Harness() {
        const [search, setSearch] = useState(initial);
        // Estável como o da rota.
        const onSearchChange = useCallback(
            (next: Partial<CashFlowSearch>, options?: { replace?: boolean }) => {
                setSearch((previous) => {
                    const merged = { ...previous, ...next };
                    searches.push(merged);
                    replaced.push(options?.replace ?? false);
                    return merged;
                });
            },
            [],
        );
        return (
            <CashFlowPage
                search={search}
                onSearchChange={onSearchChange}
                rowActions={rowActions}
                alerts={<p>alerta das ações</p>}
                dialogs={<p>diálogos das ações</p>}
            />
        );
    }

    const router = createRouter({
        routeTree: createRootRoute({ component: Harness }),
        history: createMemoryHistory(),
    });
    await router.load();
    await act(async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <NoticeProvider store={notices}>
                    <RouterProvider router={router} />
                </NoticeProvider>
            </QueryClientProvider>,
        );
    });
    return { searches, replaced, notices };
}

const TABLE = 'Fluxo de caixa de outubro de 2026';

async function rows() {
    const table = await screen.findByRole('table', { name: TABLE });
    return within(table).getAllByRole('row').slice(1);
}

const summaryCard = (name: string) =>
    within(screen.getByRole('region', { name: 'Resumo do mês' })).getByRole('region', { name });

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(TODAY));
    routeApi();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('CashFlowPage (spec 0015)', () => {
    // AC-0015-14, INV-0015-07.
    it('lists the month rows by date, without card expenses, with the statement of the active card', async () => {
        await renderPage({});
        const list = await rows();
        expect(list.map((row) => within(row).getAllByRole('cell')[1]?.textContent)).toEqual([
            'SalárioSalário · Conta corrente',
            'AluguelMoradia · Conta corrente',
            'Fatura Itaú VisaConta corrente',
            'ReembolsoSalário · Conta corrente',
            'FarmáciaMoradia · Conta corrente',
            'InternetMoradia · Conta corrente',
            'FreelaSalário · Conta corrente',
        ]);
        expect(screen.queryByText('Mercado no cartão')).toBeNull();
        expect(within(list[2]!).getByText('−R$ 1.025,50')).toBeVisible();
        expect(within(list[0]!).getByText('+R$ 5.000,00')).toBeVisible();

        // Uma consulta de faturas só para o cartão ativo, na janela do mês.
        const statementCalls = mocks.GET.mock.calls.filter(([path]) => path === '/statements');
        expect(statementCalls).toEqual([
            [
                '/statements',
                {
                    params: {
                        query: {
                            creditCardId: card().id,
                            from: '2026-08-01',
                            to: '2026-10-31',
                        },
                    },
                },
            ],
        ]);
        expect(mocks.GET).toHaveBeenCalledWith('/reports/balance', {
            params: { query: { from: '2026-09', to: '2026-10', bankAccountId: undefined } },
        });

        // Os links de cada linha.
        const links = list.map((row) => within(row).getByRole('link').getAttribute('href'));
        expect(links.slice(0, 3)).toEqual([
            '/receitas/e1',
            '/despesas/x1',
            `/cartoes/${card().id}/faturas/s1`,
        ]);
        expect(screen.getByText('alerta das ações')).toBeInTheDocument();
        expect(screen.getByText('diálogos das ações')).toBeInTheDocument();
    });

    // AC-0015-14: o filtro muda só a lista; navegar de mês mantém o filtro.
    it('filters by situation without changing the summary and keeps the filter across months', async () => {
        const { searches } = await renderPage({ situacao: 'a-vencer' });
        const list = await rows();
        expect(list).toHaveLength(3);
        expect(summaryCard('Entradas')).toHaveTextContent('+R$ 5.900,00');
        expect(summaryCard('Entradas')).toHaveTextContent('1 realizada · 2 pendentes');
        expect(summaryCard('Saídas')).toHaveTextContent('−R$ 2.971,10');

        fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'realizados' } });
        expect(await rows()).toHaveLength(2);
        expect(searches.at(-1)).toEqual({ situacao: 'realizados', mes: undefined });

        fireEvent.change(screen.getByLabelText('Situação'), { target: { value: '' } });
        expect(searches.at(-1)?.situacao).toBeUndefined();

        fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'vencidos' } });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
        });
        expect(searches.at(-1)).toEqual({ mes: '2026-11', situacao: 'vencidos' });
    });

    // AC-0015-15.
    it('shows the balances with their badges and the note of earlier overdue entries', async () => {
        await renderPage({});
        await rows();
        expect(summaryCard('Saldo no início')).toHaveTextContent('R$ 4.876,55');
        expect(summaryCard('Saldo no início')).toHaveTextContent('Realizado');
        // 612345 − 102550.
        expect(summaryCard('Saldo no fim')).toHaveTextContent('R$ 5.097,95');
        expect(summaryCard('Saldo no fim')).toHaveTextContent('Previsto');

        expect(
            await screen.findByText('O saldo previsto conta com 1 vencida de meses anteriores.'),
        ).toBeVisible();
        expect(screen.getByRole('link', { name: 'Ver despesas vencidas' })).toHaveAttribute(
            'href',
            '/despesas?status=OVERDUE',
        );
        expect(screen.queryByRole('link', { name: 'Ver receitas vencidas' })).toBeNull();
    });

    it('shows no overdue note outside the current month and a dash without a balance point', async () => {
        routeApi({ balance: { from: '2026-09', to: '2026-11', points: [] } });
        await renderPage({ mes: '2026-11' });
        await screen.findByRole('table', { name: 'Fluxo de caixa de novembro de 2026' });
        expect(summaryCard('Saldo no fim')).toHaveTextContent('—');
        expect(screen.queryByText(/vencidas? de meses anteriores/)).toBeNull();
        expect(mocks.GET).not.toHaveBeenCalledWith('/earnings', {
            params: { query: { status: 'OVERDUE' } },
        });
    });

    it('renders the row menus the route composes and none when there are none', async () => {
        await renderPage(
            {},
            {
                expense: (expense) => <button type="button">menu {expense.description}</button>,
                earning: (earning) => <button type="button">menu {earning.description}</button>,
                statement: () => null,
            },
        );
        await rows();
        expect(screen.getAllByRole('button', { name: 'menu Aluguel' })).toHaveLength(2);
        expect(screen.getAllByRole('button', { name: 'menu Salário' })).toHaveLength(2);
        expect(screen.getAllByRole('columnheader').at(-1)).toHaveTextContent('Ações');
    });

    it('has no actions column without row menus', async () => {
        await renderPage({}, {});
        await rows();
        expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
            'Data',
            'Descrição',
            'Situação',
            'Valor',
        ]);
    });

    it('shows the empty month message', async () => {
        mocks.GET.mockImplementation((path: string) =>
            Promise.resolve(path === '/reports/balance' ? ok(BALANCE) : ok([])),
        );
        await renderPage({ situacao: 'vencidos' });
        expect(await screen.findByText('Nada entra nem sai neste mês.')).toBeVisible();
    });

    it('says nothing is in the chosen situation', async () => {
        routeApi({ earnings: [SALARY], expenses: [RENT] });
        await renderPage({ situacao: 'vencidos' });
        expect(await screen.findByText('Nada nesta situação neste mês.')).toBeVisible();
    });

    // ERR-0015-01: uma consulta que falha mostra o erro; tentar de novo consulta outra vez.
    it('shows the error of a failed list query and retries it', async () => {
        routeApi({ statementsFail: true });
        await renderPage({});
        const retries = await screen.findAllByRole('button', { name: 'Tentar de novo' });
        expect(retries.length).toBeGreaterThan(0);
        routeApi();
        await act(async () => {
            fireEvent.click(retries[0]!);
        });
        expect(await rows()).toHaveLength(7);
    });

    it('keeps the list when only the balance fails', async () => {
        routeApi({ balanceFail: true });
        await renderPage({});
        expect(await rows()).toHaveLength(7);
        expect(
            within(screen.getByRole('region', { name: 'Resumo do mês' })).getByRole('button', {
                name: 'Tentar de novo',
            }),
        ).toBeVisible();
    });
    // AC-0015-18, INV-0015-08: com uma conta escolhida, todo número é daquela conta.
    it('shows only the chosen account rows, its cards statements and its transfers', async () => {
        await renderPage({ conta: ACCOUNT_ID }, undefined, [OTHER_CARD]);
        const list = await rows();
        expect(list.map((row) => within(row).getAllByRole('cell')[1]?.textContent)).toEqual([
            'ReservaConta corrente → Poupança',
            'SalárioSalário · Conta corrente',
            'AluguelMoradia · Conta corrente',
            'Fatura Itaú VisaConta corrente',
            'ReembolsoSalário · Conta corrente',
            'FarmáciaMoradia · Conta corrente',
            'ResgatePoupança → Conta corrente',
            'InternetMoradia · Conta corrente',
            'FreelaSalário · Conta corrente',
            'AporteConta corrente → Poupança',
        ]);
        expect(screen.queryByText('Fatura Nubank')).toBeNull();
        expect(within(list[0]!).getByText('−R$ 200,00')).toBeVisible();
        expect(within(list[0]!).getByText('Concluída')).toBeVisible();
        expect(within(list[0]!).getByRole('link')).toHaveAttribute('href', '/transferencias/t1');
        expect(within(list[6]!).getByText('+R$ 150,00')).toBeVisible();
        expect(within(list[6]!).getByText('Agendada')).toBeVisible();

        // As consultas levam a conta; as faturas, só dos cartões que ela paga.
        for (const path of ['/earnings', '/expenses']) {
            expect(mocks.GET).toHaveBeenCalledWith(path, {
                params: {
                    query: { from: '2026-10-01', to: '2026-10-31', bankAccountId: ACCOUNT_ID },
                },
            });
        }
        expect(mocks.GET).toHaveBeenCalledWith('/bank-transfers', {
            params: { query: { from: '2026-10-01', to: '2026-10-31', bankAccountId: ACCOUNT_ID } },
        });
        expect(mocks.GET).toHaveBeenCalledWith('/reports/balance', {
            params: { query: { from: '2026-09', to: '2026-10', bankAccountId: ACCOUNT_ID } },
        });
        expect(
            mocks.GET.mock.calls.filter(([path]) => path === '/statements').map(([, init]) => init),
        ).toEqual([
            {
                params: {
                    query: { creditCardId: card().id, from: '2026-08-01', to: '2026-10-31' },
                },
            },
        ]);
        // Sem conta, nenhuma consulta foi feita para todas as contas.
        expect(mocks.GET).not.toHaveBeenCalledWith('/earnings', {
            params: { query: { from: '2026-10-01', to: '2026-10-31' } },
        });

        // Entradas: 500000 + 10000 + 80000 + 15000; saídas: 180000 + 102550 + 4570 + 9990 +
        // 20000 + 5000. O fim é o da conta: 300000 − 102550.
        expect(summaryCard('Entradas')).toHaveTextContent('+R$ 6.050,00');
        expect(summaryCard('Entradas')).toHaveTextContent('1 realizada · 3 pendentes');
        expect(summaryCard('Saídas')).toHaveTextContent('−R$ 3.221,10');
        expect(summaryCard('Saídas')).toHaveTextContent('2 realizadas · 4 pendentes');
        expect(summaryCard('Saldo no início')).toHaveTextContent('R$ 2.000,00');
        expect(summaryCard('Saldo no fim')).toHaveTextContent('R$ 1.974,50');

        // A nota conta a despesa vencida e a transferência agendada de setembro; os links levam a
        // conta.
        expect(
            await screen.findByText('O saldo previsto conta com 2 vencidas de meses anteriores.'),
        ).toBeVisible();
        expect(screen.getByRole('link', { name: 'Ver despesas vencidas' })).toHaveAttribute(
            'href',
            `/despesas?status=OVERDUE&conta=${ACCOUNT_ID}`,
        );
        expect(mocks.GET).toHaveBeenCalledWith('/bank-transfers', {
            params: { query: { bankAccountId: ACCOUNT_ID, status: 'SCHEDULED' } },
        });
    });

    // AC-0015-18: os filtros de situação e de conta se mantêm; em Todas as contas, sem transferências.
    it('filters transfers by situation, keeps the account across months and drops it for all', async () => {
        const { searches } = await renderPage(
            { conta: ACCOUNT_ID, situacao: 'vencidos' },
            undefined,
            [OTHER_CARD],
        );
        const list = await rows();
        expect(list.map((row) => within(row).getAllByRole('cell')[1]?.textContent)).toEqual([
            'ReembolsoSalário · Conta corrente',
            'FarmáciaMoradia · Conta corrente',
            'ResgatePoupança → Conta corrente',
        ]);
        expect(screen.getByLabelText('Conta')).toHaveValue(ACCOUNT_ID);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
        });
        expect(searches.at(-1)).toEqual({
            mes: '2026-11',
            situacao: 'vencidos',
            conta: ACCOUNT_ID,
        });

        fireEvent.change(screen.getByLabelText('Situação'), { target: { value: '' } });
        fireEvent.change(screen.getByLabelText('Conta'), { target: { value: '' } });
        expect(searches.at(-1)).toEqual({ mes: '2026-11', situacao: undefined, conta: undefined });
        const november = await screen.findByRole('table', {
            name: 'Fluxo de caixa de novembro de 2026',
        });
        expect(within(november).queryByText('Reserva')).toBeNull();
    });

    it('brings back every statement and no transfer for all the accounts', async () => {
        await renderPage({}, undefined, [OTHER_CARD]);
        const list = await rows();
        expect(list).toHaveLength(8);
        expect(screen.getAllByText('Fatura Nubank').length).toBeGreaterThan(0);
        expect(screen.queryByText('Reserva')).toBeNull();
        expect(mocks.GET).not.toHaveBeenCalledWith('/bank-transfers', expect.anything());
    });

    // AC-0015-18: id fora de `GET /bank-accounts` é descartado, sem entrada no histórico.
    it('drops an unknown account id', async () => {
        const { searches, replaced } = await renderPage({ conta: 'desconhecida' });
        expect(await rows()).toHaveLength(7);
        expect(searches.at(-1)?.conta).toBeUndefined();
        expect(replaced.at(-1)).toBe(true);
        expect(mocks.GET).not.toHaveBeenCalledWith(
            '/earnings',
            expect.objectContaining({
                params: { query: expect.objectContaining({ bankAccountId: 'desconhecida' }) },
            }),
        );
    });

    // Mapa de erros: `BANK_ACCOUNT_NOT_FOUND` → aviso e o filtro de conta é removido.
    it('drops the account filter with a notice on BANK_ACCOUNT_NOT_FOUND', async () => {
        routeApi({ accountNotFound: true });
        const { notices, searches } = await renderPage({ conta: ACCOUNT_ID });
        await vi.waitFor(() =>
            expect(notices.getSnapshot()).toEqual([
                expect.objectContaining({ tone: 'erro', message: 'Conta não encontrada.' }),
            ]),
        );
        expect(searches.at(-1)?.conta).toBeUndefined();
        expect(await rows()).toHaveLength(7);
        expect(summaryCard('Saldo no fim')).toHaveTextContent('R$ 5.097,95');
    });
});
