import { act, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    users: vi.fn(),
    workspaces: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
}));
vi.mock('@/api/client', () => ({
    api: { GET: mocks.get, PATCH: mocks.patch, DELETE: mocks.del },
}));

import { ERROR_MESSAGES } from '@/api/errors/catalog';

import { ADMIN_ME, fail, ok, platformUser, renderUsersPage } from './test-utils';

const ELISA = platformUser({ id: 'elisa', name: 'Elisa Prado' });
const PRINCIPAL = {
    id: 'ws-principal',
    name: 'Principal',
    memberCount: 2,
    createdAt: '2026-09-01T12:00:00Z',
};
const CASA = { id: 'ws-casa', name: 'Casa', memberCount: 1, createdAt: '2026-09-02T12:00:00Z' };

const table = () => screen.getByRole('table', { name: 'Usuários da plataforma', hidden: true });
const row = (name: string) => within(table()).getByText(name).closest('tr')!;

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

async function openDialog() {
    await renderUsersPage(ADMIN_ME, { profileUserId: 'elisa' });
    return screen.findByRole('dialog', { name: 'Liberar acesso de Elisa Prado' });
}

beforeEach(() => {
    mocks.get.mockReset().mockImplementation((path: string) => {
        if (path === '/users/me') return Promise.resolve(ok({ data: ADMIN_ME }));
        if (path === '/workspaces') return mocks.workspaces();
        return mocks.users(path);
    });
    mocks.users.mockReset().mockResolvedValue(ok({ data: [ADMIN_ME, ELISA] }));
    mocks.workspaces.mockReset().mockResolvedValue(ok({ data: [PRINCIPAL, CASA] }));
    mocks.patch.mockReset();
    mocks.del.mockReset();
});

describe('ApproveDialog', () => {
    it('starts on Novo espaço with the user name suggested and the fixed admin text', async () => {
        const dialog = await openDialog();

        expect(within(dialog).getByRole('radio', { name: 'Novo espaço' })).toBeChecked();
        expect(within(dialog).getByLabelText('Nome do espaço')).toHaveValue('Elisa Prado');
        expect(
            within(dialog).getByText('Elisa Prado será o administrador deste espaço.'),
        ).toBeInTheDocument();
        expect(within(dialog).queryByRole('radio', { name: /Leitor/ })).toBeNull();
    });

    // AC-0021-02, INV-0021-03, INV-0021-04: espaço novo envia sempre `profile: 'ADMIN'`.
    it('approves into a new space and shows the row only after the backend list answers', async () => {
        const created = platformUser({
            id: 'elisa',
            name: 'Elisa Prado',
            profile: 'ADMIN',
            workspace: { id: 'ws-casa', name: 'Casa' },
        });
        mocks.patch.mockResolvedValue(ok({ data: created }));
        const refetched = deferred<unknown>();
        const dialog = await openDialog();
        mocks.users.mockReturnValueOnce(refetched.promise);

        fireEvent.change(within(dialog).getByLabelText('Nome do espaço'), {
            target: { value: '  Casa  ' },
        });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

        await waitFor(() =>
            expect(mocks.patch).toHaveBeenCalledWith('/users/{id}/profile', {
                params: { path: { id: 'elisa' } },
                body: { profile: 'ADMIN', newWorkspace: { name: 'Casa' } },
            }),
        );
        await waitFor(() => expect(mocks.users).toHaveBeenCalledTimes(2));
        expect(within(row('Elisa Prado')).getByText('Aguardando')).toBeInTheDocument();

        await act(async () => refetched.resolve(ok({ data: [ADMIN_ME, created] })));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(within(row('Elisa Prado')).getByText('Administrador')).toBeInTheDocument();
        expect(within(row('Elisa Prado')).getByText('Casa')).toBeInTheDocument();
        expect(
            screen.getByText('Acesso de Elisa Prado liberado no espaço Casa.'),
        ).toBeInTheDocument();
    });

    it('disables Salvar while the space name is blank and rejects a blank trimmed name', async () => {
        const dialog = await openDialog();
        const save = within(dialog).getByRole('button', { name: 'Salvar' });

        fireEvent.change(within(dialog).getByLabelText('Nome do espaço'), {
            target: { value: '   ' },
        });
        expect(save).toBeDisabled();
        expect(mocks.patch).not.toHaveBeenCalled();
    });

    // AC-0021-03, INV-0021-03: espaço existente envia `{ profile, workspaceId }`.
    it('approves into an existing space with the chosen profile', async () => {
        mocks.patch.mockResolvedValue(ok({ data: { ...ELISA, profile: 'VIEWER' } }));
        const dialog = await openDialog();

        fireEvent.click(within(dialog).getByRole('radio', { name: 'Espaço existente' }));
        const save = within(dialog).getByRole('button', { name: 'Salvar' });
        expect(save).toBeDisabled();
        const select = await within(dialog).findByLabelText('Espaço');
        await within(dialog).findByRole('option', { name: 'Principal (2 membros)' });
        expect(within(dialog).getByRole('option', { name: 'Casa (1 membro)' })).toBeInTheDocument();
        fireEvent.change(select, { target: { value: 'ws-principal' } });
        fireEvent.click(within(dialog).getByRole('radio', { name: /Leitor/ }));
        expect(save).toBeEnabled();
        fireEvent.click(save);

        await waitFor(() =>
            expect(mocks.patch).toHaveBeenCalledWith('/users/{id}/profile', {
                params: { path: { id: 'elisa' } },
                body: { profile: 'VIEWER', workspaceId: 'ws-principal' },
            }),
        );
        expect(
            await screen.findByText('Acesso de Elisa Prado liberado no espaço Principal.'),
        ).toBeInTheDocument();
    });

    // AC-0021-05: `409 USER_ALREADY_IN_WORKSPACE` no alerta; a lista é recarregada.
    it('shows USER_ALREADY_IN_WORKSPACE in the alert and reloads the users', async () => {
        mocks.patch.mockResolvedValue(fail(409, 'USER_ALREADY_IN_WORKSPACE'));
        const dialog = await openDialog();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            ERROR_MESSAGES.USER_ALREADY_IN_WORKSPACE,
        );
        await waitFor(() => expect(mocks.users).toHaveBeenCalledTimes(2));
    });

    // ERR-0021-01: `WORKSPACE_NOT_FOUND` no alerta; a lista de espaços é recarregada.
    it('shows WORKSPACE_NOT_FOUND and reloads the workspaces', async () => {
        mocks.patch.mockResolvedValue(fail(404, 'WORKSPACE_NOT_FOUND'));
        const dialog = await openDialog();
        fireEvent.click(within(dialog).getByRole('radio', { name: 'Espaço existente' }));
        await within(dialog).findByRole('option', { name: 'Casa (1 membro)' });
        fireEvent.change(within(dialog).getByLabelText('Espaço'), { target: { value: 'ws-casa' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            ERROR_MESSAGES.WORKSPACE_NOT_FOUND,
        );
        await waitFor(() => expect(mocks.workspaces).toHaveBeenCalledTimes(2));
    });

    // ERR-0021-01: `VALIDATION_ERROR` em `name` vira erro do campo.
    it('maps a VALIDATION_ERROR on name to the field', async () => {
        mocks.patch.mockResolvedValue({
            error: {
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'x',
                    details: [{ path: ['newWorkspace', 'name'], message: 'x' }],
                },
            },
            response: new Response(null, { status: 400 }),
        });
        const dialog = await openDialog();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

        await waitFor(() => expect(within(dialog).getByLabelText('Nome do espaço')).toBeInvalid());
    });

    // ERR-0021-02: `GET /workspaces` falha; Novo espaço continua, Espaço existente fica desabilitado.
    it('disables Espaço existente when the workspaces cannot be loaded', async () => {
        mocks.workspaces.mockResolvedValue(fail(500, 'INTERNAL_ERROR'));
        const dialog = await openDialog();

        await waitFor(() =>
            expect(within(dialog).getByRole('radio', { name: 'Espaço existente' })).toBeDisabled(),
        );
        expect(within(dialog).getByRole('radio', { name: 'Novo espaço' })).toBeEnabled();
    });
});
