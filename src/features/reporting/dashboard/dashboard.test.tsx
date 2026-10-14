import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get } }));

import { CURRENT_USER_QUERY_KEY, type CurrentUser } from '@/api/queries/current-user';

import { REPORT_HREF } from './by-type-section';
import { Dashboard } from './dashboard';
import {
    account,
    balancePoint,
    balanceReport,
    byTypeReport,
    card,
    earning,
    expense,
    statement,
} from './test-data';

const CORRENTE = account({
    id: 'a1',
    description: 'Conta corrente',
    currentBalanceCents: -12345,
});
const POUPANCA = account({ id: 'a2', description: 'Poupança', currentBalanceCents: 500000 });
const ARQUIVADA = account({
    id: 'a3',
    description: 'Arquivada',
    currentBalanceCents: 999900,
    archivedAt: '2026-09-01T12:00:00Z',
});
const ROXINHO = card({
    id: 'c1',
    name: 'Nubank Roxinho',
    creditLimitCents: 500000,
    availableLimitCents: 350000,
});
const VISA = card({ id: 'c2', name: 'Itaú Visa', availableLimitCents: -2550 });
const ANTIGO = card({ id: 'c3', name: 'Cartão antigo', archivedAt: '2026-09-01T12:00:00Z' });

const FARMACIA = expense({
    id: 'e1',
    description: 'Farmácia',
    status: 'OVERDUE',
    amountCents: 4570,
    occurredOn: '2026-10-08',
});
const INTERNET = expense({
    id: 'e2',
    description: 'Internet',
    amountCents: 9990,
    bankAccountId: 'a2',
});
const ALUGUEL = expense({
    id: 'e3',
    description: 'Aluguel',
    status: 'PAID',
    amountCents: 180000,
    occurredOn: '2026-10-05',
});

const ROXINHO_CLOSED = statement({
    id: 's1',
    creditCardId: 'c1',
    status: 'CLOSED',
    dueOn: '2026-10-15',
    remainingCents: 35000,
});
const VISA_OPEN = statement({ id: null, creditCardId: 'c2', status: 'OPEN', dueOn: '2026-11-05' });

function me(profile: CurrentUser['profile']): CurrentUser {
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

const ok = (data: unknown) => ({ data: { data }, response: new Response(null, { status: 200 }) });
const failure = (status: number, code: string) => ({
    error: { error: { code, message: 'raw' } },
    response: new Response(null, { status }),
});

type Init = { params?: { query?: Record<string, string> } };
type Responder = (path: string, query: Record<string, string>) => unknown;

/** A API do dashboard de 15/10/2026; `override` responde antes, quando devolve algo. */
function stubApi(override: Responder = () => undefined) {
    mocks.get.mockImplementation((path: string, init?: Init) => {
        const query = init?.params?.query ?? {};
        const custom = override(path, query);
        if (custom !== undefined) return Promise.resolve(custom);
        switch (path) {
            case '/bank-accounts':
                return Promise.resolve(ok([POUPANCA, ARQUIVADA, CORRENTE]));
            case '/credit-cards':
                return Promise.resolve(ok([VISA, ANTIGO, ROXINHO]));
            case '/reports/balance':
                return Promise.resolve(
                    ok(
                        balanceReport([
                            balancePoint({
                                month: '2026-10',
                                kind: 'FORECAST',
                                accountsTotalCents: 612345,
                            }),
                        ]),
                    ),
                );
            case '/reports/expenses-by-type':
                return Promise.resolve(
                    ok(
                        byTypeReport([
                            {
                                month: '2026-10',
                                totalCents: 0,
                                byType: [
                                    { typeId: 't1', name: 'Moradia', totalCents: 245000 },
                                    { typeId: 't2', name: 'Educação', totalCents: 120000 },
                                    { typeId: 't3', name: 'Mercado', totalCents: 23490 },
                                    { typeId: 't4', name: 'Lazer', totalCents: 10000 },
                                    { typeId: 't5', name: 'Saúde', totalCents: 4570 },
                                ],
                            },
                        ]),
                    ),
                );
            case '/earnings':
                return Promise.resolve(
                    ok([
                        earning({ id: 'r1', status: 'RECEIVED', amountCents: 500000 }),
                        earning({ id: 'r2', status: 'OVERDUE', amountCents: 150000 }),
                        earning({ id: 'r3', status: 'FORECAST', amountCents: 80050 }),
                    ]),
                );
            case '/expenses':
                if (query.status === 'OVERDUE') return Promise.resolve(ok([FARMACIA]));
                if (query.from === '2026-10-15') return Promise.resolve(ok([INTERNET]));
                return Promise.resolve(ok([ALUGUEL, FARMACIA, INTERNET]));
            case '/statements':
                return Promise.resolve(
                    ok(query.creditCardId === 'c1' ? [ROXINHO_CLOSED] : [VISA_OPEN]),
                );
            default:
                return Promise.resolve(failure(404, 'ROUTE_NOT_FOUND'));
        }
    });
}

async function renderDashboard(profile: CurrentUser['profile'] = 'ADMIN') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, me(profile));
    const root = createRootRoute();
    const home = createRoute({ getParentRoute: () => root, path: '/', component: Dashboard });
    const router = createRouter({
        routeTree: root.addChildren([home]),
        history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    await router.load();
    await act(async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>,
        );
    });
}

const region = (name: string | RegExp) => screen.findByRole('region', { name });

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T12:00:00-03:00'));
    mocks.get.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('Dashboard (spec 0015)', () => {
    it('shows the realized and forecast balance and the month totals (AC-0015-01)', async () => {
        stubApi();
        await renderDashboard();

        expect(screen.getByRole('heading', { name: 'Início', level: 1 })).toBeInTheDocument();
        const saldo = await region('Saldo realizado · outubro de 2026');
        expect(await within(saldo).findByText('R$ 4.876,55')).toBeInTheDocument();
        expect(await within(saldo).findByText('R$ 6.123,45')).toBeInTheDocument();
        expect(within(saldo).getByText('+R$ 1.246,90')).toBeInTheDocument();
        expect(within(saldo).getByText('Previsto para 31 out.')).toBeInTheDocument();

        const receitas = await region('Receitas do mês');
        expect(await within(receitas).findByText('+R$ 7.300,50')).toBeInTheDocument();
        expect(within(receitas).getByText('1 recebida · 2 pendentes')).toBeInTheDocument();

        const despesas = await region('Despesas do mês');
        expect(await within(despesas).findByText('−R$ 1.945,60')).toBeInTheDocument();
        expect(within(despesas).getByText('1 paga · 1 pendente · 1 vencida')).toBeInTheDocument();

        expect(mocks.get).toHaveBeenCalledWith('/reports/balance', {
            params: { query: { from: '2026-10', to: '2026-10' } },
        });
        expect(mocks.get).toHaveBeenCalledWith('/earnings', {
            params: { query: { from: '2026-10-01', to: '2026-10-31' } },
        });
        expect(mocks.get).toHaveBeenCalledWith('/expenses', {
            params: { query: { from: '2026-10-15', to: '2026-10-21' } },
        });
        expect(mocks.get).toHaveBeenCalledWith('/expenses', {
            params: { query: { status: 'OVERDUE' } },
        });
        // Uma consulta de faturas por cartão ativo; o arquivado fica de fora.
        const statementCalls = mocks.get.mock.calls.filter(([path]) => path === '/statements');
        expect(statementCalls.map(([, init]) => (init as Init).params?.query)).toEqual([
            { creditCardId: 'c2' },
            { creditCardId: 'c1' },
        ]);
    });

    it('lists what is due this week with Pagar links, and the accounts and cards (AC-0015-02, AC-0015-03)', async () => {
        stubApi();
        await renderDashboard('BILLER');

        const due = await region('Vence esta semana');
        const table = await within(due).findByRole('table', { name: 'Vence esta semana' });
        const rows = within(table).getAllByRole('row').slice(1);
        expect(rows.map((row) => within(row).getAllByRole('cell')[1]?.textContent)).toEqual([
            'Farmácia',
            'Fatura Nubank Roxinho',
            'Internet',
        ]);
        expect(within(rows[0]!).getByRole('link', { name: 'Pagar' })).toHaveAttribute(
            'href',
            '/despesas/e1?pagar=1',
        );
        expect(within(rows[1]!).getByRole('link', { name: 'Pagar' })).toHaveAttribute(
            'href',
            '/cartoes/c1/faturas/s1?pagar=1',
        );
        expect(within(rows[1]!).getByText('Vence hoje')).toBeInTheDocument();
        expect(within(due).getByRole('link', { name: 'Ver todas' })).toHaveAttribute(
            'href',
            '/despesas?status=OVERDUE',
        );
        expect(screen.getByRole('link', { name: 'Nova despesa' })).toHaveAttribute(
            'href',
            '/despesas?novo=1',
        );
        expect(screen.getByRole('link', { name: 'Nova receita' })).toHaveAttribute(
            'href',
            '/receitas?novo=1',
        );

        const contas = await region('Contas e cartões');
        const accounts = within(contas).getByRole('list', { name: 'Contas' });
        expect(within(accounts).getByText('Conta corrente')).toBeInTheDocument();
        expect(within(accounts).getByText('−R$ 123,45')).toBeInTheDocument();
        expect(within(accounts).queryByText('Arquivada')).not.toBeInTheDocument();
        const cards = within(contas).getByRole('list', { name: 'Cartões' });
        const [visa, roxinho] = within(cards).getAllByRole('listitem');
        expect(within(roxinho!).getByText('−R$ 1.500,00')).toBeInTheDocument();
        expect(await within(roxinho!).findByText('Fechada')).toBeInTheDocument();
        expect(within(visa!).getByText('Em aberto')).toBeInTheDocument();
        expect(within(visa!).getByText('Fecha em 25 out.')).toBeInTheDocument();

        const byType = await region('Despesas por tipo · outubro de 2026');
        const bars = within(byType).getByRole('list', { name: 'Despesas por tipo' });
        expect(
            within(bars)
                .getAllByRole('listitem')
                .map((item) => item.textContent),
        ).toEqual([
            'MoradiaR$ 2.450,00',
            'EducaçãoR$ 1.200,00',
            'MercadoR$ 234,90',
            'OutrosR$ 145,70',
        ]);
        expect(within(byType).getByRole('link', { name: 'Ver relatório' })).toHaveAttribute(
            'href',
            REPORT_HREF,
        );
    });

    it('hides Pagar, Nova despesa and Nova receita from the viewer (AC-0015-03)', async () => {
        stubApi();
        await renderDashboard('VIEWER');

        const due = await region('Vence esta semana');
        await within(due).findByRole('table', { name: 'Vence esta semana' });
        expect(screen.queryByRole('link', { name: 'Pagar' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Nova despesa' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Nova receita' })).not.toBeInTheDocument();
    });

    it('a failing statements query only breaks its section and the card badges (AC-0015-05, INV-0015-04)', async () => {
        let healthy = false;
        stubApi((path) =>
            path === '/statements' && !healthy ? failure(500, 'INTERNAL_ERROR') : undefined,
        );
        await renderDashboard();

        const due = await region('Vence esta semana');
        expect(await within(due).findByRole('alert')).toHaveTextContent(
            'Algo deu errado do nosso lado.',
        );
        const contas = await region('Contas e cartões');
        expect(
            await within(contas).findAllByText('Não foi possível carregar a fatura.'),
        ).toHaveLength(2);
        const saldo = await region('Saldo realizado · outubro de 2026');
        expect(await within(saldo).findByText('R$ 4.876,55')).toBeInTheDocument();

        healthy = true;
        fireEvent.click(within(due).getByRole('button', { name: 'Tentar de novo' }));
        expect(
            await within(due).findByRole('table', { name: 'Vence esta semana' }),
        ).toBeInTheDocument();
        expect(await within(contas).findByText('Fechada')).toBeInTheDocument();
    });

    it('shows the empty states', async () => {
        stubApi((path) => {
            if (path === '/expenses') return ok([]);
            if (path === '/statements') return ok([]);
            if (path === '/reports/expenses-by-type') return ok(byTypeReport([]));
            if (path === '/reports/balance') return ok(balanceReport([]));
            if (path === '/bank-accounts' || path === '/credit-cards') return ok([]);
            return undefined;
        });
        await renderDashboard();

        expect(await screen.findByText('Nada vence esta semana.')).toBeInTheDocument();
        expect(await screen.findByText('Nenhuma despesa no mês.')).toBeInTheDocument();
        expect(await screen.findByText('Nenhuma conta ou cartão ativo.')).toBeInTheDocument();
        expect(await screen.findByText('—')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Ver todas' })).not.toBeInTheDocument();
    });

    it('shows a skeleton per section while loading', async () => {
        mocks.get.mockReturnValue(new Promise(() => undefined));
        await renderDashboard();

        expect(screen.getAllByRole('status', { name: 'Carregando' }).length).toBeGreaterThan(4);
    });
});
