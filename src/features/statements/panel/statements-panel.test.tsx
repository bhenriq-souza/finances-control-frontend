import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get } }));

import { queryKeys } from '@/api/queries/keys';

import { StatementsPanel } from './statements-panel';
import {
    ACCOUNTS,
    CARD_ID,
    CLOSED,
    CLOSED_ID,
    CURRENT,
    EXPENSE_ID,
    OLDER,
    OLDER_ID,
    UPCOMING,
} from './test-data';

type Init = { params?: { query?: Record<string, string> } };

const ok = (body: unknown) => ({
    data: body,
    error: undefined,
    response: { ok: true, status: 200 },
});
const fail = (status: number, code: string) => ({
    data: undefined,
    error: { error: { code, message: 'raw backend message' } },
    response: { ok: false, status },
});

type Response = ReturnType<typeof ok> | ReturnType<typeof fail>;

function stubApi({
    current = ok({ data: CURRENT }) as Response,
    list = ok({ data: [OLDER, CURRENT, CLOSED] }) as Response,
} = {}) {
    mocks.get.mockImplementation((path: string, init: Init) => {
        if (path === '/statements/current') return Promise.resolve(current);
        if (path === '/statements') {
            return Promise.resolve(init.params?.query?.from ? ok({ data: UPCOMING }) : list);
        }
        return Promise.resolve(fail(404, 'ROUTE_NOT_FOUND'));
    });
}

async function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(queryKeys.bankAccounts.all, ACCOUNTS);
    const root = createRootRoute();
    const page = createRoute({
        getParentRoute: () => root,
        path: '/',
        component: () => <StatementsPanel cardId={CARD_ID} />,
    });
    const router = createRouter({
        routeTree: root.addChildren([page]),
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

const section = (name: string) => screen.getByRole('region', { name });
const valueOf = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling;
const tableRows = (caption: string) =>
    within(screen.getByRole('table', { name: caption }))
        .getAllByRole('row')
        .slice(1);

beforeEach(() => {
    mocks.get.mockReset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T12:00:00-03:00'));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('StatementsPanel (spec 0013)', () => {
    // AC-0013-01, INV-0013-01: período, vencimento, selo e os valores da resposta.
    it('shows the current statement with period, dates, badge, values and by type', async () => {
        stubApi();
        await renderPanel();

        const current = section('Fatura atual');
        expect(await within(current).findByText('Período')).toBeInTheDocument();
        expect(mocks.get).toHaveBeenCalledWith('/statements/current', {
            params: { query: { creditCardId: CARD_ID } },
        });
        expect(valueOf('Período')).toHaveTextContent('9 out. – 8 nov.');
        expect(valueOf('Fecha em')).toHaveTextContent('8 de nov. de 2026');
        expect(valueOf('Vence em')).toHaveTextContent('15 de nov. de 2026');
        expect(within(current).getAllByText('Em aberto')[0]).toBeInTheDocument();

        expect(valueOf('Compras')).toHaveTextContent('R$ 523,45');
        expect(valueOf('Estornos')).toHaveTextContent('−R$ 20,00');
        expect(screen.queryByText('Saldo anterior')).toBeNull();
        expect(valueOf('Total da fatura')).toHaveTextContent('R$ 503,45');
        expect(valueOf('Pago')).toHaveTextContent('R$ 100,00');
        expect(valueOf('Restante')).toHaveTextContent('R$ 403,45');
        expect(valueOf('Restante')?.querySelector('[data-tone="negativo"]')).toBeNull();
        expect(valueOf('Mínimo informado')).toHaveTextContent('Não informado');

        const byType = within(current).getByRole('list', { name: 'Compras por tipo' });
        const types = within(byType).getAllByRole('listitem');
        expect(types[0]).toHaveTextContent('EletrônicosR$ 400,00');
        expect(types[1]).toHaveTextContent('MercadoR$ 123,45');
    });

    it('shows the expenses, refunds and payments of the current statement', async () => {
        stubApi();
        await renderPanel();

        const [expense] = await vi.waitFor(() => tableRows('Despesas da fatura'));
        expect(expense).toHaveTextContent('Notebook');
        expect(expense).toHaveTextContent('2/3');
        expect(expense).toHaveTextContent('Pendente');
        expect(expense).toHaveTextContent('−R$ 400,00');
        expect(within(expense!).getByRole('link', { name: 'Notebook' })).toHaveAttribute(
            'href',
            `/despesas/${EXPENSE_ID}`,
        );

        const [refund] = tableRows('Estornos da fatura');
        expect(refund).toHaveTextContent('Estorno da loja');
        expect(refund).toHaveTextContent('+R$ 20,00');

        const [payment] = tableRows('Pagamentos da fatura');
        expect(payment).toHaveTextContent('15 out.');
        expect(payment).toHaveTextContent('Conta corrente');
        expect(payment).toHaveTextContent('R$ 100,00');

        // Só leitura nesta tarefa: nenhum botão de ação.
        expect(screen.queryByRole('button')).toBeNull();
    });

    // AC-0013-01: anteriores em ordem decrescente, com selo e link.
    it('lists the previous statements newest first, with badge and link, without the open one', async () => {
        stubApi();
        await renderPanel();

        const rows = await vi.waitFor(() => tableRows('Faturas anteriores'));
        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveTextContent('outubro de 2026');
        expect(rows[0]).toHaveTextContent('15 out.');
        expect(rows[0]).toHaveTextContent('Vencida');
        expect(rows[0]).toHaveTextContent('R$ 350,00');
        expect(within(rows[0]!).getByRole('link')).toHaveAttribute(
            'href',
            `/cartoes/${CARD_ID}/faturas/${CLOSED_ID}`,
        );
        expect(rows[1]).toHaveTextContent('setembro de 2026');
        expect(rows[1]).toHaveTextContent('Paga');
        expect(within(rows[1]!).getByRole('link')).toHaveAttribute(
            'href',
            `/cartoes/${CARD_ID}/faturas/${OLDER_ID}`,
        );
        expect(mocks.get).toHaveBeenCalledWith('/statements', {
            params: { query: { creditCardId: CARD_ID } },
        });
    });

    // AC-0013-01, INV-0013-03: próximas pela janela, sem link.
    it('lists the upcoming statements in the window after the current closing, without links', async () => {
        stubApi();
        await renderPanel();

        const rows = await vi.waitFor(() => tableRows('Próximas faturas'));
        expect(mocks.get).toHaveBeenCalledWith('/statements', {
            params: { query: { creditCardId: CARD_ID, from: '2026-11-09', to: '2027-11-08' } },
        });
        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveTextContent('dezembro de 2026');
        expect(rows[0]).toHaveTextContent('R$ 400,01');
        expect(rows[1]).toHaveTextContent('janeiro de 2027');
        expect(rows[1]).toHaveTextContent('R$ 400,00');
        const upcoming = section('Próximas faturas');
        expect(within(upcoming).queryAllByRole('link')).toHaveLength(0);
    });

    // ERR-0013-02: cada bloco falha sozinho, com a mensagem do catálogo.
    it('fails block by block: the current fails, the previous still show', async () => {
        stubApi({ current: fail(500, 'INTERNAL_ERROR') });
        await renderPanel();

        const current = section('Fatura atual');
        expect(await within(current).findByRole('alert')).toHaveTextContent(
            'Não foi possível carregar.',
        );
        expect(within(current).getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
        expect(screen.queryByText('raw backend message')).toBeNull();
        expect(within(section('Próximas faturas')).getByRole('alert')).toBeInTheDocument();
        await vi.waitFor(() => expect(tableRows('Faturas anteriores')).toHaveLength(2));
    });

    it('shows the empty states with no previous and no upcoming statement', async () => {
        mocks.get.mockImplementation((path: string, init: Init) => {
            if (path === '/statements/current') return Promise.resolve(ok({ data: CURRENT }));
            // Sem janela, só a aberta; na janela das próximas, nenhuma.
            return Promise.resolve(ok({ data: init.params?.query?.from ? [] : [CURRENT] }));
        });
        await renderPanel();

        expect(await screen.findByText('Nenhuma fatura fechada.')).toBeInTheDocument();
        expect(await screen.findByText('Nenhuma fatura futura.')).toBeInTheDocument();
    });
});
