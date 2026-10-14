import { act, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), users: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/api/client', () => ({
    api: { GET: mocks.get, PATCH: mocks.patch, DELETE: mocks.del },
}));

import { ERROR_MESSAGES } from '@/api/errors/catalog';

import { ADMIN_ME, fail, ok, platformUser, renderUsersPage } from './test-utils';

const ELISA = platformUser({ id: 'elisa', name: 'Elisa Prado' });
const DIEGO = platformUser({ id: 'diego', name: 'Diego Reis', profile: 'VIEWER' });

// Com um diálogo aberto o resto da página fica `aria-hidden`: `hidden: true` ainda acha a tabela.
const table = () => screen.getByRole('table', { name: 'Usuários da plataforma', hidden: true });
/** O botão de ação de uma linha da tabela (o cartão do celular repete o mesmo botão). */
const rowAction = async (name: string) =>
    within(await screen.findByRole('table', { name: 'Usuários da plataforma' })).getByRole(
        'button',
        { name },
    );
const row = (name: string) => within(table()).getByText(name).closest('tr')!;

/** Promessa resolvida à mão: prova que a lista espera a resposta do backend (INV-0010-03). */
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

beforeEach(() => {
    // `invalidateAfter(…, 'profile')` também recarrega `GET /users/me`; `mocks.users` é só `GET /users`.
    mocks.get
        .mockReset()
        .mockImplementation((path: string) =>
            path === '/users/me' ? Promise.resolve(ok({ data: ADMIN_ME })) : mocks.users(path),
        );
    mocks.users.mockReset().mockResolvedValue(ok({ data: [ADMIN_ME, DIEGO, ELISA] }));
    mocks.patch.mockReset();
    mocks.del.mockReset();
});

describe('ProfileDialog', () => {
    it('describes the three profiles and keeps Salvar disabled until the choice changes', async () => {
        await renderUsersPage();
        fireEvent.click(await rowAction('Alterar perfil de Diego Reis'));

        const dialog = screen.getByRole('dialog', { name: 'Alterar perfil de Diego Reis' });
        const admin = within(dialog).getByRole('radio', { name: /Administrador/ });
        expect(admin).toHaveAccessibleDescription(
            'Tudo, inclusive usuários, bancos, contas e cartões',
        );
        expect(within(dialog).getByRole('radio', { name: /Lançador/ })).toHaveAccessibleDescription(
            'Lança e altera despesas, receitas, faturas e transferências',
        );
        const viewer = within(dialog).getByRole('radio', { name: /Leitor/ });
        expect(viewer).toHaveAccessibleDescription('Só consulta');
        expect(viewer).toBeChecked();

        const save = within(dialog).getByRole('button', { name: 'Salvar' });
        expect(save).toBeDisabled();
        fireEvent.click(admin);
        expect(save).toBeEnabled();
        fireEvent.click(viewer);
        expect(save).toBeDisabled();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(mocks.patch).not.toHaveBeenCalled();
    });

    // AC-0010-02, INV-0010-03: PATCH com o perfil escolhido; a linha muda pela resposta do backend.
    it('grants a profile and shows it only after the backend list answers', async () => {
        mocks.patch.mockResolvedValue(ok({ data: { ...ELISA, profile: 'BILLER' } }));
        const refetched = deferred<unknown>();
        await renderUsersPage();
        fireEvent.click(await rowAction('Liberar acesso de Elisa Prado'));

        const dialog = screen.getByRole('dialog', { name: 'Liberar acesso de Elisa Prado' });
        expect(within(dialog).queryByRole('radio', { checked: true })).not.toBeInTheDocument();
        expect(within(dialog).queryByRole('button', { name: 'Revogar acesso' })).toBeNull();
        expect(within(dialog).getByRole('button', { name: 'Salvar' })).toBeDisabled();
        mocks.users.mockReturnValueOnce(refetched.promise);

        fireEvent.click(within(dialog).getByRole('radio', { name: /Lançador/ }));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

        await waitFor(() =>
            expect(mocks.patch).toHaveBeenCalledWith('/users/{id}/profile', {
                params: { path: { id: 'elisa' } },
                body: { profile: 'BILLER' },
            }),
        );
        await waitFor(() => expect(mocks.users).toHaveBeenCalledTimes(2));
        // Sem atualização otimista: até o GET responder, a linha continua como antes.
        expect(within(row('Elisa Prado')).getByText('Aguardando')).toBeInTheDocument();

        await act(async () =>
            refetched.resolve(ok({ data: [ADMIN_ME, DIEGO, { ...ELISA, profile: 'BILLER' }] })),
        );

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(within(row('Elisa Prado')).getByText('Lançador')).toBeInTheDocument();
        expect(screen.getByText('Perfil de Elisa Prado atualizado.')).toBeInTheDocument();
    });

    // AC-0010-03, INV-0010-03: revogar pede confirmação, envia DELETE e a linha volta a Aguardando.
    it('revokes the access after a confirmation', async () => {
        mocks.del.mockResolvedValue(ok({ data: { ...DIEGO, profile: null } }));
        await renderUsersPage();
        fireEvent.click(await rowAction('Alterar perfil de Diego Reis'));
        const dialog = screen.getByRole('dialog', { name: 'Alterar perfil de Diego Reis' });
        mocks.users.mockResolvedValue(ok({ data: [ADMIN_ME, { ...DIEGO, profile: null }, ELISA] }));

        fireEvent.click(within(dialog).getByRole('button', { name: 'Revogar acesso' }));
        const confirm = screen.getByRole('alertdialog', {
            name: 'Revogar o acesso de Diego Reis?',
        });
        expect(confirm).toHaveTextContent(
            'Diego Reis volta para a tela de aguardando aprovação e perde o acesso a tudo até receber um perfil de novo.',
        );
        expect(mocks.del).not.toHaveBeenCalled();
        fireEvent.click(within(confirm).getByRole('button', { name: 'Revogar' }));

        await waitFor(() =>
            expect(mocks.del).toHaveBeenCalledWith('/users/{id}/profile', {
                params: { path: { id: 'diego' } },
            }),
        );
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(within(row('Diego Reis')).getByText('Aguardando')).toBeInTheDocument();
        expect(screen.getByText('Acesso de Diego Reis revogado.')).toBeInTheDocument();
    });

    // ERR-0010-01 na revogação: a mensagem do catálogo na confirmação, que continua aberta.
    it('keeps the confirmation open with the catalog message when revoking fails', async () => {
        mocks.del.mockResolvedValue(fail(409, 'LAST_ADMIN'));
        await renderUsersPage(ADMIN_ME, { profileUserId: 'diego' });
        const dialog = await screen.findByRole('dialog', { name: 'Alterar perfil de Diego Reis' });

        fireEvent.click(within(dialog).getByRole('button', { name: 'Revogar acesso' }));
        const confirm = screen.getByRole('alertdialog');
        fireEvent.click(within(confirm).getByRole('button', { name: 'Revogar' }));

        expect(await within(confirm).findByRole('alert')).toHaveTextContent(
            ERROR_MESSAGES.LAST_ADMIN,
        );
        expect(within(row('Diego Reis')).getByText('Leitor')).toBeInTheDocument();
        expect(mocks.users).toHaveBeenCalledTimes(1);
    });

    // ERR-0010-03: o usuário sumiu; o alerta fica no diálogo mesmo depois de a lista recarregar.
    it('keeps the USER_NOT_FOUND alert after the reloaded list drops the user', async () => {
        mocks.del.mockResolvedValue(fail(404, 'USER_NOT_FOUND'));
        await renderUsersPage(ADMIN_ME, { profileUserId: 'diego' });
        const dialog = await screen.findByRole('dialog', { name: 'Alterar perfil de Diego Reis' });
        mocks.users.mockResolvedValue(ok({ data: [ADMIN_ME, ELISA] }));

        fireEvent.click(within(dialog).getByRole('button', { name: 'Revogar acesso' }));
        fireEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Revogar' }),
        );

        await waitFor(() => expect(mocks.users).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(within(table()).queryByText('Diego Reis')).toBeNull());
        expect(within(screen.getByRole('alertdialog')).getByRole('alert')).toHaveTextContent(
            ERROR_MESSAGES.USER_NOT_FOUND,
        );
    });
});
