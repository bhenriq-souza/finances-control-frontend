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
    delete: vi.fn(),
}));
vi.mock('@/api/client', () => ({
    api: { GET: mocks.get, POST: mocks.post, PATCH: mocks.patch, DELETE: mocks.delete },
}));

import { CURRENT_USER_QUERY_KEY, type Profile } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import type { ExpenseType } from '@/api/queries/reference';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import { ExpenseTypesPage } from './expense-types-page';
import type { ExpenseTypesSearch } from './search';

const TYPES: ExpenseType[] = [
    { id: 't-moradia', name: 'Moradia', archivedAt: null, createdAt: '2026-10-01T00:00:00Z' },
    {
        id: 't-antigo',
        name: 'Academia',
        archivedAt: '2026-09-01T00:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
    },
    { id: 't-mercado', name: 'mercado', archivedAt: null, createdAt: '2026-10-01T00:00:00Z' },
];

const ok = (body: unknown = { data: {} }, status = 200) => ({
    data: body,
    response: new Response(null, { status }),
});
const fail = (status: number, code: string, details?: unknown) => ({
    error: { error: { code, message: 'raw', details } },
    response: new Response(null, { status }),
});

function user(profile: Profile) {
    return {
        id: 'id',
        email: 'a@b.c',
        emailVerified: true,
        name: 'Ana',
        profile,
        profileGrantedAt: null,
        createdAt: '2026-10-01T00:00:00Z',
    };
}

interface Setup {
    profile?: Profile;
    search?: ExpenseTypesSearch;
    types?: ExpenseType[] | null;
}

async function renderPage({ profile = 'ADMIN', search = {}, types = TYPES }: Setup = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(CURRENT_USER_QUERY_KEY, user(profile));
    if (types) client.setQueryData(queryKeys.expenseTypes.all, types);
    const changes: ExpenseTypesSearch[] = [];

    function Harness() {
        const [current, setCurrent] = useState(search);
        return (
            <ExpenseTypesPage
                search={current}
                onSearchChange={(next) => {
                    changes.push(next);
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
            <QueryClientProvider client={client}>
                <NoticeProvider store={createNoticeStore()}>
                    <RouterProvider router={router} />
                </NoticeProvider>
            </QueryClientProvider>,
        );
    });
    return { client, changes };
}

/** Os cartões (abaixo de `md`); no jsdom a tabela também está no DOM. */
const cards = () => screen.getByRole('list', { name: 'Tipos de despesa' });
const notices = () => screen.getByRole('region', { name: 'Avisos' });

beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    // A invalidação depois de uma escrita consulta de novo.
    mocks.get.mockResolvedValue(ok({ data: TYPES }));
});

describe('ExpenseTypesPage', () => {
    it('lists the active types by name and hides the archived ones by default', async () => {
        await renderPage();

        const items = within(cards()).getAllByRole('listitem');
        expect(items.map((item) => item.textContent)).toEqual([
            expect.stringContaining('mercado'),
            expect.stringContaining('Moradia'),
        ]);
        expect(screen.queryByText('Academia')).not.toBeInTheDocument();
        expect(screen.getByRole('table')).toHaveAccessibleName('Tipos de despesa');
    });

    it('shows the archived types with the Arquivado badge when asked', async () => {
        const { changes } = await renderPage();

        fireEvent.click(screen.getByLabelText('Mostrar arquivados'));

        expect(changes).toEqual([{ arquivados: 1 }]);
        expect(screen.getByRole('checkbox', { name: 'Mostrar arquivados' })).toBeChecked();
        const archived = within(cards()).getByText('Academia').closest('li')!;
        expect(within(archived).getByText('Arquivado')).toBeInTheDocument();
        expect(
            within(archived).getByRole('button', { name: 'Desarquivar Academia' }),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Mostrar arquivados'));
        expect(changes.at(-1)).toEqual({});
    });

    // AC-0012-11: criar.
    it('creates a type through ?novo=1 and closes on success', async () => {
        mocks.post.mockResolvedValue(ok({ data: TYPES[0] }, 201));
        const { changes } = await renderPage();

        fireEvent.click(screen.getByRole('button', { name: 'Novo tipo' }));
        expect(changes).toEqual([{ novo: 1 }]);
        const dialog = await screen.findByRole('dialog', { name: 'Novo tipo de despesa' });

        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
        expect(await within(dialog).findByText('Informe o nome.')).toBeInTheDocument();
        expect(mocks.post).not.toHaveBeenCalled();

        fireEvent.change(within(dialog).getByLabelText('Nome'), {
            target: { value: '  Saúde  ' },
        });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

        await waitFor(() => expect(changes.at(-1)).toEqual({}));
        expect(mocks.post).toHaveBeenCalledWith('/expense-types', { body: { name: 'Saúde' } });
        expect(within(notices()).getByText('Tipo de despesa salvo.')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // AC-0012-11: `409 EXPENSE_TYPE_ALREADY_EXISTS` marca o nome; o formulário fica aberto.
    it('marks the name on EXPENSE_TYPE_ALREADY_EXISTS and keeps the form open', async () => {
        mocks.post.mockResolvedValue(fail(409, 'EXPENSE_TYPE_ALREADY_EXISTS'));
        await renderPage({ search: { novo: 1 } });

        const dialog = await screen.findByRole('dialog', { name: 'Novo tipo de despesa' });
        fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Moradia' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

        const name = within(dialog).getByLabelText('Nome');
        await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
        expect(name).toHaveAccessibleDescription(
            'Já existe um tipo de despesa com esse nome. Escolha outro nome.',
        );
        expect(name).toHaveValue('Moradia');
    });

    it('shows any other write error in the form alert', async () => {
        mocks.post.mockResolvedValue(fail(403, 'FORBIDDEN'));
        await renderPage({ search: { novo: 1 } });

        const dialog = await screen.findByRole('dialog', { name: 'Novo tipo de despesa' });
        fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Lazer' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

        expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
        expect(within(dialog).getByLabelText('Nome')).toHaveValue('Lazer');
    });

    // AC-0012-11: renomear.
    it('renames a type through ?editar=<id>', async () => {
        mocks.patch.mockResolvedValue(ok({ data: TYPES[0] }));
        const { changes } = await renderPage();

        fireEvent.click(within(cards()).getByRole('button', { name: 'Renomear Moradia' }));
        expect(changes).toEqual([{ editar: 't-moradia' }]);
        const dialog = await screen.findByRole('dialog', { name: 'Renomear tipo de despesa' });
        const name = within(dialog).getByLabelText('Nome');
        expect(name).toHaveValue('Moradia');

        fireEvent.change(name, { target: { value: 'Casa' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

        await waitFor(() => expect(changes.at(-1)).toEqual({}));
        expect(mocks.patch).toHaveBeenCalledWith('/expense-types/{id}', {
            params: { path: { id: 't-moradia' } },
            body: { name: 'Casa' },
        });
        expect(within(notices()).getByText('Tipo de despesa renomeado.')).toBeInTheDocument();
    });

    it('closes the form with Cancelar without calling the API', async () => {
        const { changes } = await renderPage({ search: { arquivados: 1, editar: 't-antigo' } });

        const dialog = await screen.findByRole('dialog', { name: 'Renomear tipo de despesa' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

        expect(changes).toEqual([{ arquivados: 1 }]);
        expect(mocks.patch).not.toHaveBeenCalled();
    });

    it('ignores ?editar with an unknown id', async () => {
        await renderPage({ search: { editar: 'desconhecido' } });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // AC-0012-11: arquivar e desarquivar invalidam `expense-types`.
    it('archives an active type and unarchives an archived one', async () => {
        mocks.post.mockResolvedValue(ok());
        mocks.delete.mockResolvedValue(ok());
        const { client } = await renderPage({ search: { arquivados: 1 } });
        const invalidate = vi.spyOn(client, 'invalidateQueries');

        fireEvent.click(within(cards()).getByRole('button', { name: 'Arquivar Moradia' }));
        expect(await within(notices()).findByText('Tipo arquivado.')).toBeInTheDocument();
        expect(mocks.post).toHaveBeenCalledWith('/expense-types/{id}/archive', {
            params: { path: { id: 't-moradia' } },
        });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['expense-types'] });

        fireEvent.click(within(cards()).getByRole('button', { name: 'Desarquivar Academia' }));
        expect(await within(notices()).findByText('Tipo desarquivado.')).toBeInTheDocument();
        expect(mocks.delete).toHaveBeenCalledWith('/expense-types/{id}/archive', {
            params: { path: { id: 't-antigo' } },
        });
    });

    it('shows the catalog message when archiving fails', async () => {
        mocks.post.mockResolvedValue(fail(404, 'EXPENSE_TYPE_NOT_FOUND'));
        await renderPage();

        fireEvent.click(within(cards()).getByRole('button', { name: 'Arquivar Moradia' }));

        const notice = await within(notices()).findByText(/tipo de despesa/i);
        expect(notice.closest('[data-tone]')).toHaveAttribute('data-tone', 'erro');
    });

    it('shows a generic message when archiving fails without an API error', async () => {
        mocks.post.mockRejectedValue(new TypeError('boom'));
        await renderPage();

        fireEvent.click(within(cards()).getByRole('button', { name: 'Arquivar Moradia' }));

        expect(
            await within(notices()).findByText(
                'O servidor respondeu de um jeito inesperado. Tente de novo em instantes.',
            ),
        ).toBeInTheDocument();
    });

    // INV-0009-03: sem `entries.write`, nenhum controle de escrita e `?novo=1` sem efeito.
    it('renders no write control for a VIEWER and ignores ?novo and ?editar', async () => {
        await renderPage({ profile: 'VIEWER', search: { novo: 1 } });

        expect(screen.queryByRole('button', { name: 'Novo tipo' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Renomear|Arquivar/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('columnheader', { name: 'Ações' })).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(within(cards()).getByText('Moradia')).toBeInTheDocument();
    });

    it('lets a BILLER write', async () => {
        await renderPage({ profile: 'BILLER' });
        expect(screen.getByRole('button', { name: 'Novo tipo' })).toBeInTheDocument();
    });

    it('shows the empty state without types', async () => {
        await renderPage({ types: [] });
        expect(screen.getByText('Nenhum tipo de despesa ativo.')).toBeInTheDocument();
    });

    it('shows the skeleton while loading and the error state with a retry on failure', async () => {
        let reject: (value: unknown) => void = () => undefined;
        mocks.get.mockReturnValueOnce(new Promise((done) => (reject = done)));
        await renderPage({ types: null });

        expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument();
        expect(mocks.get).toHaveBeenCalledWith('/expense-types', {
            params: { query: { archived: 'true' } },
        });

        mocks.get.mockResolvedValueOnce(ok({ data: TYPES }));
        await act(async () => reject(fail(503, 'SERVICE_UNAVAILABLE')));
        const retry = await screen.findByRole('button', { name: 'Tentar de novo' });
        fireEvent.click(retry);
        const list = await screen.findByRole('list', { name: 'Tipos de despesa' });
        expect(within(list).getByText('Moradia')).toBeInTheDocument();
    });
});
