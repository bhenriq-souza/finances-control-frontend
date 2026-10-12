import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
    useParams,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get } }));

import { queryKeys } from '@/api/queries/keys';

import type { Earning } from '../list/earning-model';
import { CHECKING, earning, OLD_ACCOUNT, SAVINGS } from '../list/test-data';

import { EarningDetail } from './earning-detail';

function ok(data: unknown) {
    return { data: { data }, response: new Response(null, { status: 200 }) };
}

function failure(status: number, code: string) {
    return {
        error: { error: { code, message: 'raw' } },
        response: new Response(null, { status }),
    };
}

async function renderDetail(id: string) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(queryKeys.bankAccounts.all, [CHECKING, SAVINGS, OLD_ACCOUNT]);

    const root = createRootRoute();
    const list = createRoute({
        getParentRoute: () => root,
        path: '/receitas',
        component: () => <h1>Lista</h1>,
    });
    const detail = createRoute({
        getParentRoute: () => root,
        path: '/receitas/$receitaId',
        component: function Detail() {
            const { receitaId = '' } = useParams({ strict: false });
            return <EarningDetail earningId={receitaId} />;
        },
    });
    const router = createRouter({
        routeTree: root.addChildren([list, detail]),
        history: createMemoryHistory({ initialEntries: [`/receitas/${id}`] }),
    });
    await router.load();
    await act(async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>,
        );
    });
    return { router };
}

function term(name: string) {
    const dt = screen.getByText(name, { selector: 'dt' });
    return dt.nextElementSibling as HTMLElement;
}

const INSTALLMENT: Earning = earning({
    id: 'r3',
    description: 'Projeto site',
    kind: 'INSTALLMENT',
    status: 'RECEIVED',
    amountCents: 50000,
    occurredOn: '2026-10-20',
    receivedOn: '2026-10-21',
    notes: 'Segunda parcela\ndo projeto',
    bankAccountId: OLD_ACCOUNT.id,
    installment: { groupId: 'grupo-1', number: 2, total: 3 },
});

beforeEach(() => {
    mocks.get.mockReset();
});

describe('EarningDetail (spec 0014)', () => {
    // INV-0014-01: o valor aparece por `Money`, com o sinal `+`; todos os campos da resposta.
    it('shows every field, the badge and the account by name', async () => {
        mocks.get.mockResolvedValue(ok(INSTALLMENT));
        await renderDetail('r3');

        expect(
            await screen.findByRole('heading', { name: 'Projeto site', level: 1 }),
        ).toBeInTheDocument();
        expect(mocks.get).toHaveBeenCalledWith('/earnings/{id}', {
            params: { path: { id: 'r3' } },
        });
        expect(screen.getByText('Recebido')).toBeInTheDocument();
        expect(screen.getByText('+R$ 500,00')).toBeInTheDocument();
        expect(term('Natureza')).toHaveTextContent('Parcelada');
        expect(term('Tipo')).toHaveTextContent('Salário');
        expect(term('Conta')).toHaveTextContent('Conta antiga');
        expect(term('Data prevista')).toHaveTextContent('20 de out. de 2026');
        expect(term('Recebida em')).toHaveTextContent('21 de out. de 2026');
        expect(term('Observações')).toHaveTextContent('Segunda parcela do projeto');
        expect(term('Parcela')).toHaveTextContent('2 de 3');
        expect(within(term('Parcela')).getByRole('link')).toHaveAttribute(
            'href',
            '/receitas?grupo=grupo-1',
        );
    });

    it('shows dashes for a pending earning without notes and no installment row', async () => {
        mocks.get.mockResolvedValue(
            ok(earning({ id: 'r1', description: 'Salário', kind: 'FIXED', recurrenceId: 's1' })),
        );
        await renderDetail('r1');

        await screen.findByRole('heading', { name: 'Salário', level: 1 });
        expect(term('Natureza')).toHaveTextContent('Fixa');
        expect(term('Conta')).toHaveTextContent('Conta corrente');
        expect(term('Recebida em')).toHaveTextContent('—');
        expect(term('Observações')).toHaveTextContent('—');
        expect(screen.queryByText('Parcela', { selector: 'dt' })).not.toBeInTheDocument();
        expect(screen.getByText('Pendente')).toBeInTheDocument();
    });

    it('links back to the list', async () => {
        mocks.get.mockResolvedValue(ok(INSTALLMENT));
        const { router } = await renderDetail('r3');

        await act(async () => {
            fireEvent.click(screen.getByRole('link', { name: 'Receitas' }));
        });
        expect(router.state.location.pathname).toBe('/receitas');
    });

    // ERR-0014-02 / ERR-0009-02: `EARNING_NOT_FOUND` vira o estado "não encontrado".
    it('shows the not found state for EARNING_NOT_FOUND', async () => {
        mocks.get.mockResolvedValue(failure(404, 'EARNING_NOT_FOUND'));
        await renderDetail('sumiu');

        expect(
            await screen.findByRole('heading', { name: 'Não encontramos este item.' }),
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Voltar para a lista' })).toHaveAttribute(
            'href',
            '/receitas',
        );
    });

    // ERR-0009-01: outra falha vira o estado de erro, com Tentar de novo.
    it('shows the error state and retries on any other failure', async () => {
        mocks.get.mockResolvedValueOnce(failure(500, 'INTERNAL_ERROR'));
        mocks.get.mockResolvedValueOnce(ok(INSTALLMENT));
        await renderDetail('r3');

        const alert = await screen.findByRole('alert');
        expect(alert).not.toHaveTextContent('raw');
        await act(async () => {
            fireEvent.click(within(alert).getByRole('button', { name: 'Tentar de novo' }));
        });
        expect(
            await screen.findByRole('heading', { name: 'Projeto site', level: 1 }),
        ).toBeInTheDocument();
    });

    it('shows a loading state while the query has no data', async () => {
        mocks.get.mockReturnValue(new Promise(() => undefined));
        await renderDetail('r3');

        expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument();
    });

    it('treats a body without data as an unexpected response', async () => {
        mocks.get.mockResolvedValue({ data: {}, response: new Response(null, { status: 200 }) });
        await renderDetail('r3');

        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar.');
    });

    it('shows the error state for an error that is not from the API', async () => {
        mocks.get.mockRejectedValue(new TypeError('boom'));
        await renderDetail('r3');

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Não foi possível carregar.');
        expect(alert).not.toHaveTextContent('boom');
    });
});
