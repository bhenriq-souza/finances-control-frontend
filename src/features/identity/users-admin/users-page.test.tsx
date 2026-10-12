import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), users: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/api/client', () => ({
    api: { GET: mocks.get, PATCH: mocks.patch, DELETE: mocks.del },
}));

import { ERROR_MESSAGES } from '@/api/errors/catalog';

import { ADMIN_ME, fail, ok, platformUser, renderUsersPage } from './test-utils';
import { sortUsers } from './users-api';
import { canManageUsers } from './users-page';

const BRUNO = platformUser({ id: 'bruno', name: 'Bruno Lima', profile: 'ADMIN' });
const CARLA = platformUser({ id: 'carla', name: 'Carla Dias', emailVerified: false });
const DIEGO = platformUser({ id: 'diego', name: 'Diego Reis', profile: 'VIEWER' });
const ELISA = platformUser({ id: 'elisa', name: 'Elisa Prado' });
const USERS = [ADMIN_ME, BRUNO, CARLA, DIEGO, ELISA];

// Com um diálogo aberto o resto da página fica `aria-hidden`: `hidden: true` ainda acha a tabela.
const table = () => screen.getByRole('table', { name: 'Usuários da plataforma', hidden: true });
/** O botão de ação de uma linha da tabela (o cartão do celular repete o mesmo botão). */
const rowAction = async (name: string) =>
    within(await screen.findByRole('table', { name: 'Usuários da plataforma' })).getByRole(
        'button',
        { name },
    );
const row = (name: string) => within(table()).getByText(name).closest('tr')!;

beforeEach(() => {
    // `invalidateAfter(…, 'profile')` também recarrega `GET /users/me`; `mocks.users` é só `GET /users`.
    mocks.get
        .mockReset()
        .mockImplementation((path: string) =>
            path === '/users/me' ? Promise.resolve(ok({ data: ADMIN_ME })) : mocks.users(path),
        );
    mocks.users.mockReset().mockResolvedValue(ok({ data: USERS }));
    mocks.patch.mockReset();
    mocks.del.mockReset();
});

describe('sortUsers', () => {
    it('puts the users without a profile first, keeping the API order in each group', () => {
        expect(sortUsers(USERS).map(({ id }) => id)).toEqual([
            'carla',
            'elisa',
            'ana',
            'bruno',
            'diego',
        ]);
    });
});

// INV-0010-01: só `ADMIN` tem a permissão e só ele dispara `GET /users`.
describe('access', () => {
    it('grants users.manage only to ADMIN', () => {
        expect(canManageUsers('ADMIN')).toBe(true);
        expect(canManageUsers('BILLER')).toBe(false);
        expect(canManageUsers('VIEWER')).toBe(false);
        expect(canManageUsers(null)).toBe(false);
    });

    it.each(['BILLER', 'VIEWER'] as const)(
        'shows the no-access state to %s without calling GET /users',
        async (profile) => {
            await renderUsersPage({ ...ADMIN_ME, profile });
            expect(screen.getByText('Seu perfil não dá acesso a esta tela.')).toBeInTheDocument();
            expect(mocks.users).not.toHaveBeenCalled();
        },
    );
});

describe('UsersPage', () => {
    it('lists the users from GET /users with the pending ones first', async () => {
        await renderUsersPage();
        await screen.findByRole('table', { name: 'Usuários da plataforma' });
        expect(mocks.users).toHaveBeenCalledWith('/users');

        const names = within(table())
            .getAllByRole('row')
            .slice(1)
            .map((tr) => within(tr).getAllByRole('cell')[0]!.textContent);
        expect(names).toEqual([
            'Carla Dias',
            'Elisa Prado',
            'Ana SouzaVocê',
            'Bruno Lima',
            'Diego Reis',
        ]);
        expect(within(row('Carla Dias')).getByText('Aguardando')).toBeInTheDocument();
        expect(within(row('Carla Dias')).getByText('Email não verificado')).toBeInTheDocument();
        expect(within(row('Diego Reis')).getByText('Leitor')).toBeInTheDocument();
        expect(within(row('Diego Reis')).getByText('1 out.')).toBeInTheDocument();
        expect(
            within(row('Elisa Prado')).getByRole('button', {
                name: 'Liberar acesso de Elisa Prado',
            }),
        ).toBeInTheDocument();
        expect(
            within(row('Bruno Lima')).getByRole('button', { name: 'Alterar perfil de Bruno Lima' }),
        ).toBeInTheDocument();
    });

    // AC-0010-05, INV-0010-02: a própria linha mostra "Você" e nenhuma ação.
    it('marks the own row with Você and offers no action on it', async () => {
        await renderUsersPage();
        await screen.findByRole('table', { name: 'Usuários da plataforma' });

        const own = row('Ana Souza');
        expect(within(own).getByText('Você')).toBeInTheDocument();
        expect(within(own).queryByRole('button')).not.toBeInTheDocument();
        const ownCard = screen
            .getByRole('list', { name: 'Usuários da plataforma' })
            .querySelectorAll('li')[2]!;
        expect(within(ownCard).getByText('Você')).toBeInTheDocument();
        expect(within(ownCard).queryByRole('button')).not.toBeInTheDocument();
        expect(screen.getAllByText('Você')).toHaveLength(2);
    });

    // INV-0010-02: `?perfil=<próprio id>` não abre o diálogo.
    it('does not open the profile dialog for the own user', async () => {
        await renderUsersPage(ADMIN_ME, { profileUserId: ADMIN_ME.id });
        await screen.findByRole('table', { name: 'Usuários da plataforma' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('filters to the pending users with their count', async () => {
        await renderUsersPage();
        const pending = await screen.findByRole('button', { name: 'Aguardando aprovação (2)' });
        expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );

        fireEvent.click(pending);

        expect(pending).toHaveAttribute('aria-pressed', 'true');
        expect(within(table()).getAllByRole('row')).toHaveLength(3);
        expect(within(table()).queryByText('Bruno Lima')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
        expect(within(table()).getAllByRole('row')).toHaveLength(6);
    });

    it('says when nobody is waiting for approval', async () => {
        mocks.users.mockResolvedValue(ok({ data: [ADMIN_ME, BRUNO] }));
        await renderUsersPage();
        fireEvent.click(await screen.findByRole('button', { name: 'Aguardando aprovação (0)' }));
        expect(screen.getByText('Ninguém aguardando aprovação.')).toBeInTheDocument();
    });

    // ERR-0010-05 (ERR-0009-01): a consulta falhou.
    it('shows the error state with the catalog message and retries', async () => {
        mocks.users.mockResolvedValueOnce(fail(500, 'INTERNAL_ERROR'));
        await renderUsersPage();

        expect(await screen.findByRole('alert')).toHaveTextContent(ERROR_MESSAGES.INTERNAL_ERROR);
        fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
        expect(await screen.findByRole('table', { name: 'Usuários da plataforma' })).toBeVisible();
    });

    // AC-0010-04, ERR-0010-01: `409 LAST_ADMIN` no diálogo, que continua aberto; nada muda.
    it('keeps the dialog open with the LAST_ADMIN message', async () => {
        mocks.patch.mockResolvedValue(fail(409, 'LAST_ADMIN'));
        await renderUsersPage();
        fireEvent.click(await rowAction('Alterar perfil de Bruno Lima'));

        const dialog = screen.getByRole('dialog', { name: 'Alterar perfil de Bruno Lima' });
        fireEvent.click(within(dialog).getByRole('radio', { name: /Leitor/ }));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            ERROR_MESSAGES.LAST_ADMIN,
        );
        expect(dialog).toBeInTheDocument();
        expect(mocks.users).toHaveBeenCalledTimes(1);
        expect(within(row('Bruno Lima')).getByText('Administrador')).toBeInTheDocument();
    });

    // ERR-0010-02: `CANNOT_CHANGE_OWN_PROFILE` no alerta do diálogo.
    it('shows CANNOT_CHANGE_OWN_PROFILE in the dialog alert', async () => {
        mocks.patch.mockResolvedValue(fail(409, 'CANNOT_CHANGE_OWN_PROFILE'));
        await renderUsersPage(ADMIN_ME, { profileUserId: 'diego' });

        const dialog = await screen.findByRole('dialog', { name: 'Alterar perfil de Diego Reis' });
        fireEvent.click(within(dialog).getByRole('radio', { name: /Lançador/ }));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            ERROR_MESSAGES.CANNOT_CHANGE_OWN_PROFILE,
        );
    });

    // ERR-0010-03: `404 USER_NOT_FOUND` no alerta, e a lista é recarregada.
    it('reloads the list after USER_NOT_FOUND', async () => {
        mocks.patch.mockResolvedValue(fail(404, 'USER_NOT_FOUND'));
        await renderUsersPage(ADMIN_ME, { profileUserId: 'elisa' });

        const dialog = await screen.findByRole('dialog', { name: 'Liberar acesso de Elisa Prado' });
        fireEvent.click(within(dialog).getByRole('radio', { name: /Leitor/ }));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            ERROR_MESSAGES.USER_NOT_FOUND,
        );
        await waitFor(() => expect(mocks.users).toHaveBeenCalledTimes(2));
    });
});
