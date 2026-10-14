import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
    useNavigate,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/api/client', () => ({
    api: { GET: mocks.get, PATCH: mocks.patch, DELETE: mocks.del },
}));

import { CURRENT_USER_QUERY_KEY, type CurrentUser } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import { today } from '@/shared/dates';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import type { Earning } from './earning-model';
import { EarningListPage } from './earning-list-page';
import { earningListSearchSchema } from './earning-search';
import { CHECKING, earning, FREELANCE_TYPE, SALARY_TYPE, SAVINGS } from './test-data';

const BY_ID: Record<string, Earning> = {
    open: earning({ id: 'open', description: 'Projeto', status: 'OPEN', occurredOn: '2026-10-08' }),
    forecast: earning({
        id: 'forecast',
        description: 'Aluguel da sala',
        status: 'FORECAST',
        occurredOn: '2026-10-10',
    }),
    received: earning({
        id: 'received',
        description: 'Salário',
        status: 'RECEIVED',
        receivedOn: '2026-10-05',
        occurredOn: '2026-10-05',
    }),
    verifying: earning({
        id: 'verifying',
        description: 'Consultoria',
        status: 'VERIFYING',
        occurredOn: '2026-10-12',
    }),
};
const ALL = Object.values(BY_ID);

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
const noContent = () => ({ data: undefined, response: new Response(null, { status: 204 }) });
const failure = (status: number, code: string) => ({
    error: { error: { code, message: 'raw' } },
    response: new Response(null, { status }),
});

async function renderList(url: string, profile: CurrentUser['profile'] = 'BILLER') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, me(profile));
    queryClient.setQueryData(queryKeys.bankAccounts.all, [CHECKING, SAVINGS]);
    queryClient.setQueryData(queryKeys.earningTypes.all, [SALARY_TYPE, FREELANCE_TYPE]);

    const root = createRootRoute();
    const list = createRoute({
        getParentRoute: () => root,
        path: '/receitas',
        validateSearch: earningListSearchSchema,
        component: function List() {
            const search = list.useSearch();
            const navigate = useNavigate();
            return (
                <EarningListPage
                    search={search}
                    onSearchChange={(next) => void navigate({ to: '/receitas', search: next })}
                />
            );
        },
    });
    const detail = createRoute({
        getParentRoute: () => root,
        path: '/receitas/$receitaId',
        component: () => <h1>Detalhe</h1>,
    });
    const router = createRouter({
        routeTree: root.addChildren([list, detail]),
        history: createMemoryHistory({ initialEntries: [url] }),
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
    await screen.findByRole('table', { name: 'Receitas' });
    return { router };
}

// Sem `@testing-library/user-event`: o mínimo que o Radix lê do ponteiro.
async function click(element: Element) {
    await act(async () => {
        fireEvent.pointerDown(element, { button: 0, ctrlKey: false, pointerType: 'mouse' });
        fireEvent.pointerUp(element, { button: 0, pointerType: 'mouse' });
        fireEvent.click(element);
    });
}

/** O gatilho do menu da linha na tabela (o cartão do celular repete o menu). */
function rowTrigger(description: string) {
    const table = screen.getByRole('table', { name: 'Receitas' });
    return within(table).getByRole('button', { name: `Ações de ${description}` });
}

async function openMenu(description: string) {
    await click(rowTrigger(description));
    return screen.findByRole('menu');
}

function itemNames(menu: HTMLElement) {
    return within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent);
}

beforeEach(() => {
    mocks.get.mockReset();
    mocks.patch.mockReset();
    mocks.del.mockReset();
    mocks.get.mockImplementation((path: string, init?: { params?: { path?: { id: string } } }) => {
        if (path === '/earnings/{id}') {
            return Promise.resolve(ok(BY_ID[init?.params?.path?.id ?? '']));
        }
        return Promise.resolve(ok(ALL));
    });
});

describe('earning row actions (spec 0014)', () => {
    // INV-0014-05, INV-0009-08: as ações do menu são as do detalhe para o status.
    it.each([
        ['Aluguel da sala', ['Confirmar', 'Editar', 'Excluir']],
        ['Projeto', ['Receber', 'Marcar para verificar', 'Editar', 'Excluir']],
        ['Consultoria', ['Receber', 'Voltar para pendente', 'Editar', 'Excluir']],
        ['Salário', ['Desfazer recebimento', 'Editar']],
    ])('offers the table actions in the menu of %s', async (description, names) => {
        await renderList('/receitas?mes=2026-10');
        expect(itemNames(await openMenu(description))).toEqual(names);
    });

    // AC-0014-11: Receber abre o diálogo sobre a lista, envia e mantém mês e filtros.
    it('receives from the list, keeping the month and the filters', async () => {
        mocks.patch.mockResolvedValue(ok(BY_ID.open));
        const { router } = await renderList('/receitas?mes=2026-10&status=OPEN');

        const menu = await openMenu('Projeto');
        await click(within(menu).getByRole('menuitem', { name: 'Receber' }));
        expect(router.state.location.search).toEqual({
            mes: '2026-10',
            status: 'OPEN',
            receber: 'open',
        });

        const dialog = await screen.findByRole('dialog', { name: 'Receber receita' });
        await click(within(dialog).getByRole('button', { name: 'Receber' }));
        await waitFor(() =>
            expect(mocks.patch).toHaveBeenCalledWith('/earnings/{id}/status', {
                params: { path: { id: 'open' } },
                body: { status: 'RECEIVED', receivedOn: today() },
            }),
        );
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(router.state.location.pathname).toBe('/receitas');
        expect(router.state.location.search).toEqual({ mes: '2026-10', status: 'OPEN' });
        expect(await screen.findByText('Receita recebida.')).toBeInTheDocument();
    });

    // AC-0014-12: Confirmar envia direto; um 409 vira alerta acima da lista.
    it('confirms without a dialog', async () => {
        mocks.patch.mockResolvedValue(ok(BY_ID.forecast));
        await renderList('/receitas?mes=2026-10');

        await click(
            within(await openMenu('Aluguel da sala')).getByRole('menuitem', { name: 'Confirmar' }),
        );
        await waitFor(() =>
            expect(mocks.patch).toHaveBeenCalledWith('/earnings/{id}/status', {
                params: { path: { id: 'forecast' } },
                body: { status: 'OPEN' },
            }),
        );
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(await screen.findByText('Receita confirmada.')).toBeInTheDocument();
    });

    it('shows a 409 as an alert above the list', async () => {
        mocks.patch.mockResolvedValue(failure(409, 'EARNING_STATUS_TRANSITION_NOT_ALLOWED'));
        await renderList('/receitas?mes=2026-10');

        await click(
            within(await openMenu('Aluguel da sala')).getByRole('menuitem', { name: 'Confirmar' }),
        );
        const alert = await screen.findByRole('alert');
        expect(alert).not.toHaveTextContent('raw');
        expect(alert).toHaveTextContent(/\S/);
        expect(screen.queryByText('Receita confirmada.')).not.toBeInTheDocument();
    });

    // AC-0014-12: com leitor, nenhuma linha tem menu e os parâmetros não abrem diálogo.
    it('gives a viewer no row menu and ignores the dialog parameters', async () => {
        await renderList('/receitas?mes=2026-10&receber=open&excluir=open', 'VIEWER');

        expect(screen.queryByRole('button', { name: /^Ações de/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('opens Desfazer recebimento from the menu and sends OPEN after confirming', async () => {
        mocks.patch.mockResolvedValue(ok(BY_ID.received));
        const { router } = await renderList('/receitas?mes=2026-10');

        await click(
            within(await openMenu('Salário')).getByRole('menuitem', {
                name: 'Desfazer recebimento',
            }),
        );
        expect(router.state.location.search).toMatchObject({ desfazer: 'received' });
        const dialog = await screen.findByRole('alertdialog', { name: 'Desfazer recebimento?' });
        expect(mocks.patch).not.toHaveBeenCalled();
        await click(within(dialog).getByRole('button', { name: 'Desfazer recebimento' }));
        await waitFor(() =>
            expect(mocks.patch).toHaveBeenCalledWith('/earnings/{id}/status', {
                params: { path: { id: 'received' } },
                body: { status: 'OPEN' },
            }),
        );
        await waitFor(() => expect(router.state.location.search).toEqual({ mes: '2026-10' }));
    });

    it('opens the edit form from the menu and closes it back to the list', async () => {
        const { router } = await renderList('/receitas?mes=2026-10');

        await click(within(await openMenu('Projeto')).getByRole('menuitem', { name: 'Editar' }));
        expect(router.state.location.search).toMatchObject({ editar: 'open' });
        const dialog = await screen.findByRole('dialog', { name: 'Alterar receita' });
        await click(within(dialog).getByRole('button', { name: 'Cancelar' }));
        await waitFor(() => expect(router.state.location.search).toEqual({ mes: '2026-10' }));
    });

    it('deletes from the list after showing the cascade, staying on the list', async () => {
        mocks.del.mockResolvedValue(noContent());
        const { router } = await renderList('/receitas?mes=2026-10&status=OPEN');

        await click(within(await openMenu('Projeto')).getByRole('menuitem', { name: 'Excluir' }));
        const dialog = await screen.findByRole('alertdialog', { name: 'Excluir receita?' });
        expect(dialog).toHaveTextContent('A receita será excluída.');
        await click(within(dialog).getByRole('button', { name: 'Excluir' }));
        await waitFor(() =>
            expect(mocks.del).toHaveBeenCalledWith('/earnings/{id}', {
                params: { path: { id: 'open' } },
            }),
        );
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(router.state.location.pathname).toBe('/receitas');
        expect(router.state.location.search).toEqual({ mes: '2026-10', status: 'OPEN' });
        expect(await screen.findByText('Receita excluída.')).toBeInTheDocument();
    });

    it('drops a dialog parameter that the status does not allow', async () => {
        const { router } = await renderList('/receitas?mes=2026-10&receber=received');

        await waitFor(() => expect(router.state.location.search).toEqual({ mes: '2026-10' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows the catalog message when the earning of a dialog parameter is gone', async () => {
        mocks.get.mockImplementation((path: string) =>
            Promise.resolve(
                path === '/earnings/{id}' ? failure(404, 'EARNING_NOT_FOUND') : ok(ALL),
            ),
        );
        const { router } = await renderList('/receitas?mes=2026-10&excluir=sumiu');

        const alert = await screen.findByRole('alert');
        expect(alert).not.toHaveTextContent('raw');
        await waitFor(() => expect(router.state.location.search).toEqual({ mes: '2026-10' }));
    });
});
