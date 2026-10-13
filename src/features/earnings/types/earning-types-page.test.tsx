import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
}));
vi.mock('@/api/client', () => ({
    api: { GET: mocks.get, POST: mocks.post, PATCH: mocks.patch, DELETE: mocks.del },
}));

import { CURRENT_USER_QUERY_KEY, type Profile } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import type { EarningType } from '@/api/queries/reference';
import { createNoticeStore, NoticeProvider, type NoticeStore } from '@/ui/notice';

import { EarningTypesPage, visibleEarningTypes } from './earning-types-page';
import type { EarningTypesSearch } from './search';

const SALARIO: EarningType = {
    id: 'tipo-salario',
    name: 'Salário',
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
};
const ALUGUEL: EarningType = {
    id: 'tipo-aluguel',
    name: 'Aluguel recebido',
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
};
const BONUS: EarningType = {
    id: 'tipo-bonus',
    name: 'Bônus',
    archivedAt: '2026-09-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
};
const TYPES = [SALARIO, BONUS, ALUGUEL];

/** Resposta do `openapi-fetch`: sucesso com `{ data }` ou erro com o corpo do contrato. */
function ok(data: unknown, status = 200) {
    return { data: { data }, error: undefined, response: new Response(null, { status }) };
}
function fail(status: number, code: string) {
    return {
        data: undefined,
        error: { error: { code, message: 'x' } },
        response: new Response(null, { status }),
    };
}

interface Setup {
    profile?: Profile;
    search?: EarningTypesSearch;
    types?: EarningType[] | null;
}

async function setup({ profile = 'ADMIN', search = {}, types = TYPES }: Setup = {}) {
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
    if (types) queryClient.setQueryData(queryKeys.earningTypes.all, types);
    const store: NoticeStore = createNoticeStore();
    const searches: EarningTypesSearch[] = [];

    function Harness() {
        const [current, setCurrent] = useState<EarningTypesSearch>(search);
        return (
            <EarningTypesPage
                search={current}
                onSearchChange={(next) => {
                    searches.push(next);
                    setCurrent(next);
                }}
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
                <NoticeProvider store={store}>
                    <RouterProvider router={router} />
                </NoticeProvider>
            </QueryClientProvider>,
        );
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    return { queryClient, store, searches, invalidate };
}

const table = () => screen.getByRole('table', { name: 'Tipos de receita' });
const rowNames = () =>
    within(table())
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0]!.textContent);
const notices = (store: NoticeStore) => store.getSnapshot().map((n) => `${n.tone}: ${n.message}`);

beforeEach(() => {
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.patch.mockReset();
    mocks.del.mockReset();
    // A invalidação depois de uma escrita reconsulta os tipos.
    mocks.get.mockResolvedValue(ok(TYPES));
});

describe('visibleEarningTypes', () => {
    it('keeps the active types by name, and every type when showing the archived', () => {
        expect(visibleEarningTypes(TYPES, false).map((t) => t.name)).toEqual([
            'Aluguel recebido',
            'Salário',
        ]);
        expect(visibleEarningTypes(TYPES, true).map((t) => t.name)).toEqual([
            'Aluguel recebido',
            'Bônus',
            'Salário',
        ]);
    });
});

describe('EarningTypesPage', () => {
    it('lists the active types by name and shows the archived ones with the badge on request', async () => {
        const { searches } = await setup();
        expect(screen.getByRole('heading', { name: 'Tipos de receita', level: 1 })).toBeVisible();
        expect(rowNames()).toEqual(['Aluguel recebido', 'Salário']);

        fireEvent.click(screen.getByLabelText('Mostrar arquivados'));

        expect(searches.at(-1)).toEqual({ arquivados: 1 });
        expect(rowNames()).toEqual(['Aluguel recebido', 'Bônus', 'Salário']);
        const archivedRow = within(table()).getByRole('row', { name: /Bônus/ });
        expect(within(archivedRow).getByText('Arquivado')).toBeInTheDocument();
        expect(
            within(archivedRow).getByRole('button', { name: 'Desarquivar Bônus' }),
        ).toBeInTheDocument();
        // AC-0009-11: ações de linha `outline` com ícone.
        for (const name of ['Desarquivar Bônus', 'Renomear Bônus']) {
            const button = within(archivedRow).getByRole('button', { name });
            expect(button.querySelector('svg')).not.toBeNull();
            expect(button.className).toContain('border');
        }

        fireEvent.click(screen.getByLabelText('Mostrar arquivados'));
        expect(searches.at(-1)).toEqual({ arquivados: undefined });
    });

    it('shows the loading skeleton, then the error state that retries', async () => {
        mocks.get.mockResolvedValueOnce(fail(500, 'INTERNAL_ERROR'));
        await setup({ types: null });

        expect(await screen.findByText('Não foi possível carregar.')).toBeVisible();
        mocks.get.mockResolvedValueOnce(ok(TYPES));
        fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
        await waitFor(() => expect(rowNames()).toEqual(['Aluguel recebido', 'Salário']));
        expect(mocks.get).toHaveBeenCalledWith('/earning-types', {
            params: { query: { archived: 'true' } },
        });
    });

    it('shows the empty state without types', async () => {
        await setup({ types: [] });
        expect(screen.getByText('Nenhum tipo de receita.')).toBeVisible();
    });

    // INV-0009-03 / AC-0014-07: sem `entries.write`, nenhum controle de escrita e `?novo` não abre.
    it('renders no write control for VIEWER and ignores ?novo and ?editar', async () => {
        await setup({ profile: 'VIEWER', search: { novo: 1 } });
        expect(screen.queryByRole('button', { name: 'Novo tipo' })).toBeNull();
        expect(screen.queryByRole('button', { name: /Renomear|Arquivar/ })).toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(
            within(table())
                .getAllByRole('columnheader')
                .map((h) => h.textContent),
        ).toEqual(['Nome', 'Situação']);
    });

    it('ignores ?editar for VIEWER', async () => {
        await setup({ profile: 'VIEWER', search: { editar: SALARIO.id } });
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    // AC-0014-08: criar.
    it('creates a type from Novo tipo, closes, invalidates and notifies', async () => {
        mocks.post.mockResolvedValue(ok({ ...SALARIO, id: 'novo', name: 'Dividendos' }, 201));
        const { store, searches, invalidate } = await setup({ profile: 'BILLER' });

        fireEvent.click(screen.getByRole('button', { name: 'Novo tipo' }));
        expect(searches.at(-1)).toEqual({ novo: 1, editar: undefined });
        const dialog = screen.getByRole('dialog', { name: 'Novo tipo de receita' });
        fireEvent.change(within(dialog).getByLabelText('Nome'), {
            target: { value: '  Dividendos ' },
        });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(mocks.post).toHaveBeenCalledWith('/earning-types', { body: { name: 'Dividendos' } });
        expect(searches.at(-1)).toEqual({ novo: undefined, editar: undefined });
        expect(notices(store)).toEqual(['sucesso: Tipo de receita criado.']);
        expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
            ['earning-types'],
            ['earnings'],
            ['reports'],
        ]);
    });

    it('requires a name before sending', async () => {
        await setup({ search: { novo: 1 } });
        const dialog = screen.getByRole('dialog', { name: 'Novo tipo de receita' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
        await waitFor(() =>
            expect(within(dialog).getByLabelText('Nome')).toHaveAccessibleDescription(
                'Informe o nome.',
            ),
        );
        expect(mocks.post).not.toHaveBeenCalled();
    });

    // AC-0014-08: `409 EARNING_TYPE_ALREADY_EXISTS` marca o nome; o diálogo fica aberto.
    it('marks the name on 409 EARNING_TYPE_ALREADY_EXISTS and keeps what was typed', async () => {
        mocks.post.mockResolvedValue(fail(409, 'EARNING_TYPE_ALREADY_EXISTS'));
        const { store } = await setup({ search: { novo: 1 } });
        const dialog = screen.getByRole('dialog', { name: 'Novo tipo de receita' });
        const name = within(dialog).getByLabelText('Nome');
        fireEvent.change(name, { target: { value: 'Salário' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

        await waitFor(() =>
            expect(name).toHaveAccessibleDescription(
                'Já existe um tipo de receita com esse nome. Escolha outro nome.',
            ),
        );
        expect(name).toHaveAttribute('aria-invalid', 'true');
        expect(name).toHaveValue('Salário');
        expect(screen.getByRole('dialog')).toBeVisible();
        expect(notices(store)).toEqual([]);
    });

    it('shows any other error in the form alert', async () => {
        mocks.patch.mockResolvedValue(fail(404, 'EARNING_TYPE_NOT_FOUND'));
        await setup({ search: { editar: SALARIO.id } });
        const dialog = screen.getByRole('dialog', { name: 'Renomear tipo de receita' });
        fireEvent.change(within(dialog).getByLabelText('Nome'), {
            target: { value: 'Salário CLT' },
        });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
        expect(await within(dialog).findByRole('alert')).toBeVisible();
    });

    // AC-0014-08: renomear.
    it('renames a type with PATCH and only the name', async () => {
        mocks.patch.mockResolvedValue(ok({ ...SALARIO, name: 'Salário CLT' }));
        const { store, searches } = await setup();

        fireEvent.click(screen.getAllByRole('button', { name: 'Renomear Salário' })[0]!);
        expect(searches.at(-1)).toEqual({ novo: undefined, editar: SALARIO.id });
        const dialog = screen.getByRole('dialog', { name: 'Renomear tipo de receita' });
        const name = within(dialog).getByLabelText('Nome');
        expect(name).toHaveValue('Salário');
        fireEvent.change(name, { target: { value: 'Salário CLT' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(mocks.patch).toHaveBeenCalledWith('/earning-types/{id}', {
            params: { path: { id: SALARIO.id } },
            body: { name: 'Salário CLT' },
        });
        expect(notices(store)).toEqual(['sucesso: Tipo de receita renomeado.']);
    });

    it('closes without a request when the name did not change, and on Cancelar', async () => {
        await setup({ search: { editar: SALARIO.id } });
        let dialog = screen.getByRole('dialog', { name: 'Renomear tipo de receita' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(mocks.patch).not.toHaveBeenCalled();

        fireEvent.click(screen.getAllByRole('button', { name: 'Novo tipo' })[0]!);
        dialog = screen.getByRole('dialog', { name: 'Novo tipo de receita' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('does not open the form for an unknown ?editar id', async () => {
        await setup({ search: { editar: 'desconhecido' } });
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    // AC-0014-08: arquivar e desarquivar.
    it('archives an active type and unarchives an archived one', async () => {
        mocks.post.mockResolvedValue(ok({ ...SALARIO, archivedAt: '2026-10-12T00:00:00Z' }));
        mocks.del.mockResolvedValue(ok({ ...BONUS, archivedAt: null }));
        const { store, invalidate } = await setup({ search: { arquivados: 1 } });

        fireEvent.click(within(table()).getByRole('button', { name: 'Arquivar Salário' }));
        await waitFor(() =>
            expect(notices(store)).toEqual(['sucesso: Tipo de receita arquivado.']),
        );
        expect(mocks.post).toHaveBeenCalledWith('/earning-types/{id}/archive', {
            params: { path: { id: SALARIO.id } },
        });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['earning-types'] });

        fireEvent.click(within(table()).getByRole('button', { name: 'Desarquivar Bônus' }));
        await waitFor(() =>
            expect(notices(store)).toContain('sucesso: Tipo de receita desarquivado.'),
        );
        expect(mocks.del).toHaveBeenCalledWith('/earning-types/{id}/archive', {
            params: { path: { id: BONUS.id } },
        });
    });

    it('shows the catalog message when archiving fails', async () => {
        mocks.post.mockResolvedValue(fail(404, 'EARNING_TYPE_NOT_FOUND'));
        const { store } = await setup();
        fireEvent.click(within(table()).getByRole('button', { name: 'Arquivar Salário' }));
        await waitFor(() => expect(store.getSnapshot()).toHaveLength(1));
        expect(store.getSnapshot()[0]?.tone).toBe('erro');
        expect(store.getSnapshot()[0]?.message).not.toBe('x');
    });

    it('shows the unexpected-response message for an error that is not an ApiError', async () => {
        mocks.post.mockRejectedValue(new Error('boom'));
        const { store } = await setup();
        fireEvent.click(within(table()).getByRole('button', { name: 'Arquivar Salário' }));
        await waitFor(() =>
            expect(notices(store)).toEqual([
                'erro: O servidor respondeu de um jeito inesperado. Tente de novo em instantes.',
            ]),
        );
    });
});
