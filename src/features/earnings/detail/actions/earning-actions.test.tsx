import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
    useParams,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/api/client', () => ({
    api: { GET: mocks.get, PATCH: mocks.patch, DELETE: mocks.del },
}));

import { CURRENT_USER_QUERY_KEY, type Profile } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import { today, valueToDateInput } from '@/shared/dates';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import type { Earning } from '../../list/earning-model';
import { earningDetailSearchSchema } from '../../list/earning-search';
import { CHECKING, earning } from '../../list/test-data';
import { EarningDetail } from '../earning-detail';

function ok(data: unknown) {
    return { data: { data }, error: undefined, response: new Response(null, { status: 200 }) };
}

function noContent() {
    return { data: undefined, error: undefined, response: new Response(null, { status: 204 }) };
}

function failure(status: number, code: string) {
    return {
        data: undefined,
        error: { error: { code, message: 'raw' } },
        response: new Response(null, { status }),
    };
}

const OPEN = earning({ id: 'r1', description: 'Projeto', status: 'OPEN' });
const RECEIVED = earning({
    id: 'r1',
    description: 'Projeto',
    status: 'RECEIVED',
    receivedOn: '2026-10-05',
});

/** O que `GET /earnings/{id}` devolve; um teste troca para simular a mudança noutra sessão. */
let served: Earning;

async function renderDetail(
    item: Earning,
    { profile = 'ADMIN', path = '' }: { profile?: Profile; path?: string } = {},
) {
    served = item;
    mocks.get.mockImplementation((path: string) =>
        Promise.resolve(path === '/bank-accounts' ? ok([CHECKING]) : ok(served)),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, {
        id: 'u',
        email: 'a@b.c',
        emailVerified: true,
        name: 'Ana',
        profile,
        profileGrantedAt: null,
        createdAt: '2026-10-01T00:00:00Z',
    });
    queryClient.setQueryData(queryKeys.bankAccounts.all, [CHECKING]);

    const root = createRootRoute();
    const list = createRoute({
        getParentRoute: () => root,
        path: '/receitas',
        component: () => <h1>Lista</h1>,
    });
    const detail = createRoute({
        getParentRoute: () => root,
        path: '/receitas/$receitaId',
        validateSearch: earningDetailSearchSchema,
        component: function Detail() {
            const { receitaId = '' } = useParams({ strict: false });
            return <EarningDetail earningId={receitaId} />;
        },
    });
    const router = createRouter({
        routeTree: root.addChildren([list, detail]),
        history: createMemoryHistory({ initialEntries: [`/receitas/${item.id}${path}`] }),
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
    // Com um diálogo aberto pela URL, o resto da página fica `aria-hidden`.
    await screen.findByRole('heading', { name: item.description, level: 1, hidden: true });
    return { router };
}

function actionNames() {
    const group = screen.queryByRole('group', { name: 'Ações' });
    if (!group) return [];
    return within(group)
        .getAllByRole('button')
        .map((button) => button.textContent);
}

function detailFetches() {
    return mocks.get.mock.calls.filter(([path]) => path === '/earnings/{id}').length;
}

beforeEach(() => {
    vi.unstubAllGlobals();
    mocks.get.mockReset();
    mocks.patch.mockReset();
    mocks.del.mockReset();
});

describe('EarningActions on a narrow screen (spec 0014)', () => {
    // AC-0014-13, INV-0014-05: abaixo de `md`, a primeira transição em largura total e as demais
    // (mais Excluir) em Mais ações.
    it('shows Receber full width and the rest, with Editar, under Mais ações', async () => {
        vi.stubGlobal('matchMedia', () => ({
            matches: false,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
        }));
        mocks.patch.mockResolvedValue(ok(RECEIVED));
        await renderDetail(OPEN);

        expect(actionNames()).toEqual(['Receber', 'Mais ações']);
        expect(screen.getByRole('button', { name: 'Receber' })).toHaveClass('w-full');

        await act(async () => {
            const trigger = screen.getByRole('button', { name: 'Mais ações' });
            fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
            fireEvent.pointerUp(trigger, { button: 0, pointerType: 'mouse' });
            fireEvent.click(trigger);
        });
        const menu = await screen.findByRole('menu');
        expect(
            within(menu)
                .getAllByRole('menuitem')
                .map((item) => item.textContent),
        ).toEqual(['Marcar para verificar', 'Editar', 'Excluir']);
    });
});

describe('EarningActions (spec 0014)', () => {
    // INV-0014-02: os botões de cada status são exatamente os da tabela, mais Excluir na não recebida.
    it.each([
        ['FORECAST', ['Confirmar', 'Excluir']],
        ['OPEN', ['Receber', 'Marcar para verificar', 'Excluir']],
        ['OVERDUE', ['Receber', 'Marcar para verificar', 'Excluir']],
        ['VERIFYING', ['Receber', 'Voltar para pendente', 'Excluir']],
        ['RECEIVED', ['Desfazer recebimento']],
    ] as const)('shows exactly the table actions for %s', async (status, names) => {
        await renderDetail(earning({ id: 'r1', description: 'Projeto', status }));
        expect(actionNames()).toEqual(names);
    });

    // AC-0014-07: com leitor, nenhuma ação e `?receber=1`/`?excluir=1` não abrem diálogo.
    it('shows no write action to a viewer and ignores ?receber and ?excluir', async () => {
        await renderDetail(OPEN, { profile: 'VIEWER', path: '?receber=1&excluir=1' });
        expect(screen.queryByRole('group', { name: 'Ações' })).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('lets a biller act', async () => {
        await renderDetail(OPEN, { profile: 'BILLER' });
        expect(actionNames()).toContain('Receber');
    });

    // AC-0014-05: Receber com a data padrão.
    it('receives with today as the default date', async () => {
        mocks.patch.mockResolvedValue(ok(RECEIVED));
        const { router } = await renderDetail(OPEN);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Receber' }));
        });
        expect(router.state.location.search).toEqual({ receber: 1 });
        const dialog = await screen.findByRole('dialog', { name: 'Receber receita' });
        expect(within(dialog).getByLabelText('Recebida em')).toHaveValue(valueToDateInput(today()));

        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Receber' }));
        });
        await waitFor(() =>
            expect(mocks.patch).toHaveBeenCalledWith('/earnings/{id}/status', {
                params: { path: { id: 'r1' } },
                body: { status: 'RECEIVED', receivedOn: today() },
            }),
        );
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(router.state.location.search).toEqual({});
        expect(await screen.findByText('Receita recebida.')).toBeInTheDocument();
    });

    it('sends the chosen receivedOn and requires a date', async () => {
        mocks.patch.mockResolvedValue(ok(RECEIVED));
        await renderDetail(OPEN, { path: '?receber=1' });

        const dialog = await screen.findByRole('dialog', { name: 'Receber receita' });
        const input = within(dialog).getByLabelText('Recebida em');
        fireEvent.change(input, { target: { value: '' } });
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Receber' }));
        });
        expect(await within(dialog).findByText('Informe a data do recebimento.')).toBeVisible();
        expect(mocks.patch).not.toHaveBeenCalled();

        fireEvent.change(input, { target: { value: '2026-10-03' } });
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Receber' }));
        });
        await waitFor(() =>
            expect(mocks.patch).toHaveBeenCalledWith('/earnings/{id}/status', {
                params: { path: { id: 'r1' } },
                body: { status: 'RECEIVED', receivedOn: '2026-10-03' },
            }),
        );
    });

    // AC-0014-06 (nas ações): `409 EARNING_ALREADY_RECEIVED` mostra o catálogo e recarrega o detalhe.
    it('shows the catalog message and reloads the detail on EARNING_ALREADY_RECEIVED', async () => {
        mocks.patch.mockResolvedValue(failure(409, 'EARNING_ALREADY_RECEIVED'));
        await renderDetail(OPEN, { path: '?receber=1' });
        served = RECEIVED;

        const dialog = await screen.findByRole('dialog', { name: 'Receber receita' });
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Receber' }));
        });
        // Alerta no diálogo, que continua aberto mesmo com o detalhe recarregado (spec 0014).
        const alert = await within(dialog).findByRole('alert');
        expect(alert).toHaveTextContent('Essa receita já foi recebida e não pode mais');
        expect(alert).not.toHaveTextContent('raw');
        await waitFor(() => expect(detailFetches()).toBeGreaterThan(1));
        expect(screen.getByRole('dialog', { name: 'Receber receita' })).toBeVisible();
        expect(
            screen.getByRole('region', { name: 'Avisos' }).querySelector('[data-tone="erro"]'),
        ).toBeNull();
    });

    it('keeps the receive dialog open with the alert on any other error', async () => {
        mocks.patch.mockResolvedValue(failure(404, 'EARNING_NOT_FOUND'));
        await renderDetail(OPEN, { path: '?receber=1' });

        const dialog = await screen.findByRole('dialog', { name: 'Receber receita' });
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Receber' }));
        });
        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            'Não encontramos essa receita.',
        );
    });

    it('does not open ?receber=1 when receiving is not offered', async () => {
        await renderDetail(RECEIVED, { path: '?receber=1&excluir=1' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    // AC-0014-05: Desfazer recebimento pede confirmação e envia `{ status: 'OPEN' }`.
    it('asks before undoing a receipt and sends OPEN', async () => {
        mocks.patch.mockResolvedValue(ok(OPEN));
        await renderDetail(RECEIVED);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Desfazer recebimento' }));
        });
        const dialog = await screen.findByRole('alertdialog', { name: 'Desfazer recebimento?' });
        expect(dialog).toHaveTextContent('O valor sai do saldo da conta.');
        expect(mocks.patch).not.toHaveBeenCalled();

        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Desfazer recebimento' }));
        });
        await waitFor(() =>
            expect(mocks.patch).toHaveBeenCalledWith('/earnings/{id}/status', {
                params: { path: { id: 'r1' } },
                body: { status: 'OPEN' },
            }),
        );
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(await screen.findByText('Recebimento desfeito.')).toBeInTheDocument();
    });

    it('keeps the undo dialog open with the alert and reloads the detail on a status conflict', async () => {
        mocks.patch.mockResolvedValue(failure(409, 'EARNING_STATUS_TRANSITION_NOT_ALLOWED'));
        await renderDetail(RECEIVED);
        const before = detailFetches();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Desfazer recebimento' }));
        });
        const dialog = await screen.findByRole('alertdialog');
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Desfazer recebimento' }));
        });
        const alert = await within(dialog).findByRole('alert');
        expect(alert).not.toHaveTextContent('raw');
        await waitFor(() => expect(detailFetches()).toBeGreaterThan(before));
        expect(screen.getByRole('alertdialog')).toBeVisible();
    });

    it('keeps the undo dialog open with the alert on any other error', async () => {
        mocks.patch.mockResolvedValue(failure(404, 'EARNING_NOT_FOUND'));
        await renderDetail(RECEIVED);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Desfazer recebimento' }));
        });
        const dialog = await screen.findByRole('alertdialog');
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Desfazer recebimento' }));
        });
        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            'Não encontramos essa receita.',
        );
    });

    it('cancels the undo without sending anything', async () => {
        await renderDetail(RECEIVED);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Desfazer recebimento' }));
        });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        });
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        expect(mocks.patch).not.toHaveBeenCalled();
    });

    it.each([
        ['FORECAST', 'Confirmar', 'OPEN', 'Receita confirmada.'],
        ['OPEN', 'Marcar para verificar', 'VERIFYING', 'Receita marcada para verificar.'],
        ['VERIFYING', 'Voltar para pendente', 'OPEN', 'Receita voltou para pendente.'],
    ] as const)('%s → %s sends only the status', async (status, label, target, notice) => {
        mocks.patch.mockResolvedValue(ok(OPEN));
        await renderDetail(earning({ id: 'r1', description: 'Projeto', status }));

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: label }));
        });
        await waitFor(() =>
            expect(mocks.patch).toHaveBeenCalledWith('/earnings/{id}/status', {
                params: { path: { id: 'r1' } },
                body: { status: target },
            }),
        );
        expect(await screen.findByText(notice)).toBeInTheDocument();
    });

    it('shows a direct transition error in an alert below the buttons and reloads the detail', async () => {
        mocks.patch.mockResolvedValue(failure(409, 'EARNING_STATUS_TRANSITION_NOT_ALLOWED'));
        await renderDetail(earning({ id: 'r1', description: 'Projeto', status: 'FORECAST' }));
        const before = detailFetches();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
        });
        const alert = await screen.findByRole('alert');
        expect(alert).not.toHaveTextContent('raw');
        expect(screen.getByRole('group', { name: 'Ações' }).nextElementSibling).toBe(alert);
        const notices = screen.getByRole('region', { name: 'Avisos' });
        expect(notices.querySelector('[data-tone="erro"]')).toBeNull();
        await waitFor(() => expect(detailFetches()).toBeGreaterThan(before));
    });

    // INV-0014-03: a exclusão mostra a cascata antes de enviar.
    it.each([
        [earning({ id: 'r1', description: 'Projeto' }), 'A receita será excluída.'],
        [
            earning({
                id: 'r1',
                description: 'Projeto',
                kind: 'INSTALLMENT',
                installment: { groupId: 'g', number: 1, total: 3 },
            }),
            'Todas as parcelas não recebidas deste parcelamento serão excluídas.',
        ],
        [
            earning({ id: 'r1', description: 'Projeto', kind: 'FIXED', recurrenceId: 's' }),
            'Esta ocorrência e as seguintes ainda não recebidas serão excluídas, e a série termina.',
        ],
    ])('shows the cascade before deleting (%#)', async (item, cascade) => {
        await renderDetail(item);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
        });
        const dialog = await screen.findByRole('alertdialog', { name: 'Excluir receita?' });
        expect(dialog).toHaveTextContent(cascade);
        expect(mocks.del).not.toHaveBeenCalled();
    });

    it('deletes after confirming and goes back to the list', async () => {
        mocks.del.mockResolvedValue(noContent());
        const { router } = await renderDetail(OPEN, { path: '?excluir=1' });

        const dialog = await screen.findByRole('alertdialog', { name: 'Excluir receita?' });
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));
        });
        await waitFor(() => expect(router.state.location.pathname).toBe('/receitas'));
        expect(mocks.del).toHaveBeenCalledWith('/earnings/{id}', {
            params: { path: { id: 'r1' } },
        });
        expect(await screen.findByText('Receita excluída.')).toBeInTheDocument();
    });

    it('keeps the delete dialog open with the catalog message on EARNING_NOT_FOUND', async () => {
        mocks.del.mockResolvedValue(failure(404, 'EARNING_NOT_FOUND'));
        const { router } = await renderDetail(OPEN, { path: '?excluir=1' });

        const dialog = await screen.findByRole('alertdialog');
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));
        });
        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            'Não encontramos essa receita.',
        );
        expect(router.state.location.search).toEqual({ excluir: 1 });
    });

    it('keeps the delete dialog open with the alert when it was received elsewhere', async () => {
        mocks.del.mockResolvedValue(failure(409, 'EARNING_ALREADY_RECEIVED'));
        const { router } = await renderDetail(OPEN, { path: '?excluir=1' });
        served = RECEIVED;

        const dialog = await screen.findByRole('alertdialog');
        await act(async () => {
            fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));
        });
        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            'Essa receita já foi recebida e não pode mais',
        );
        await waitFor(() => expect(detailFetches()).toBeGreaterThan(1));
        expect(screen.getByRole('alertdialog')).toBeVisible();
        expect(router.state.location.pathname).toBe('/receitas/r1');
    });

    it('closes the delete dialog on Cancelar and drops ?excluir', async () => {
        const { router } = await renderDetail(OPEN, { path: '?excluir=1' });
        await act(async () => {
            fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
        });
        await waitFor(() => expect(router.state.location.search).toEqual({}));
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
});
