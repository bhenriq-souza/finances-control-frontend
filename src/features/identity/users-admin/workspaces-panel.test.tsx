import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    users: vi.fn(),
    workspaces: vi.fn(),
    patch: vi.fn(),
}));
vi.mock('@/api/client', () => ({
    api: { GET: mocks.get, PATCH: mocks.patch, DELETE: vi.fn() },
}));

import { ERROR_MESSAGES } from '@/api/errors/catalog';
import { CURRENT_USER_QUERY_KEY } from '@/api/queries/current-user';

import { ADMIN_ME, fail, ok, renderUsersPage } from './test-utils';

const PRINCIPAL = {
    id: 'ws-principal',
    name: 'Principal',
    memberCount: 2,
    createdAt: '2026-09-01T12:00:00Z',
};
const CASA = { id: 'ws-casa', name: 'Casa', memberCount: 1, createdAt: '2026-09-02T12:00:00Z' };

beforeEach(() => {
    mocks.get.mockReset().mockImplementation((path: string) => {
        if (path === '/users/me') return Promise.resolve(ok({ data: ADMIN_ME }));
        if (path === '/workspaces') return mocks.workspaces();
        return mocks.users(path);
    });
    mocks.users.mockReset().mockResolvedValue(ok({ data: [ADMIN_ME] }));
    mocks.workspaces.mockReset().mockResolvedValue(ok({ data: [PRINCIPAL, CASA] }));
    mocks.patch.mockReset();
});

describe('WorkspacesPanel', () => {
    // AC-0021-06: lista com a contagem de membros; só chama GET /workspaces ao abrir.
    it('lists the workspaces with their member counts only after it is opened', async () => {
        await renderUsersPage();
        await screen.findByRole('table', { name: 'Usuários da plataforma' });
        expect(mocks.workspaces).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Espaços' }));

        const dialog = await screen.findByRole('dialog', { name: 'Espaços' });
        const table = await within(dialog).findByRole('table', { name: 'Espaços' });
        const rows = within(table).getAllByRole('row').slice(1);
        expect(rows).toHaveLength(2);
        expect(within(rows[0]!).getAllByRole('cell')[0]).toHaveTextContent('Principal');
        expect(within(rows[0]!).getAllByRole('cell')[1]).toHaveTextContent('2');
        expect(within(rows[1]!).getAllByRole('cell')[1]).toHaveTextContent('1');
    });

    // AC-0021-06, INV-0021-04: renomear envia `{ name }` e recarrega espaços, usuários e o menu.
    it('renames a workspace and refreshes the current user', async () => {
        mocks.patch.mockResolvedValue(ok({ data: { ...PRINCIPAL, name: 'Matriz' } }));
        const { queryClient } = await renderUsersPage(ADMIN_ME, { workspacesOpen: true });
        const dialog = await screen.findByRole('dialog', { name: 'Espaços' });
        const table = await within(dialog).findByRole('table', { name: 'Espaços' });

        fireEvent.click(within(table).getByRole('button', { name: 'Renomear Principal' }));
        const input = within(table).getByLabelText('Nome do espaço Principal');
        fireEvent.change(input, { target: { value: ' Matriz ' } });
        fireEvent.click(within(table).getByRole('button', { name: 'Salvar' }));

        await waitFor(() =>
            expect(mocks.patch).toHaveBeenCalledWith('/workspaces/{id}', {
                params: { path: { id: 'ws-principal' } },
                body: { name: 'Matriz' },
            }),
        );
        expect(await screen.findByText('Espaço renomeado para Matriz.')).toBeInTheDocument();
        await waitFor(() => expect(mocks.workspaces).toHaveBeenCalledTimes(2));
        expect(queryClient.getQueryState(CURRENT_USER_QUERY_KEY)?.isInvalidated).toBe(false);
        await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/users/me'));
    });

    it('cancels the rename without calling the API and rejects a blank name', async () => {
        await renderUsersPage(ADMIN_ME, { workspacesOpen: true });
        const dialog = await screen.findByRole('dialog', { name: 'Espaços' });
        const table = await within(dialog).findByRole('table', { name: 'Espaços' });

        fireEvent.click(within(table).getByRole('button', { name: 'Renomear Casa' }));
        fireEvent.change(within(table).getByLabelText('Nome do espaço Casa'), {
            target: { value: '   ' },
        });
        fireEvent.click(within(table).getByRole('button', { name: 'Salvar' }));
        expect(await within(table).findByText('Informe o nome do espaço.')).toBeInTheDocument();

        fireEvent.click(within(table).getByRole('button', { name: 'Cancelar' }));
        expect(within(table).queryByLabelText('Nome do espaço Casa')).toBeNull();
        expect(mocks.patch).not.toHaveBeenCalled();
    });

    it('shows the error state when the workspaces cannot be loaded', async () => {
        mocks.workspaces.mockResolvedValueOnce(fail(500, 'INTERNAL_ERROR'));
        await renderUsersPage(ADMIN_ME, { workspacesOpen: true });

        const dialog = await screen.findByRole('dialog', { name: 'Espaços' });
        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            ERROR_MESSAGES.INTERNAL_ERROR,
        );
    });
});
