import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { can, type Permission, useCan } from './permissions';
import { CURRENT_USER_QUERY_KEY, type CurrentUser, type Profile } from './queries/current-user';

const TABLE: Record<Profile, Record<Permission, boolean>> = {
    ADMIN: { 'users.manage': true, 'accounts.write': true, 'entries.write': true },
    BILLER: { 'users.manage': false, 'accounts.write': false, 'entries.write': true },
    VIEWER: { 'users.manage': false, 'accounts.write': false, 'entries.write': false },
};

const PERMISSIONS: Permission[] = ['users.manage', 'accounts.write', 'entries.write'];

function user(profile: Profile | null): CurrentUser {
    return {
        id: 'id',
        email: 'a@b.c',
        emailVerified: true,
        name: 'Ana',
        profile,
        profileGrantedAt: null,
        avatarUpdatedAt: null,
        createdAt: '2026-10-01T00:00:00Z',
    };
}

/** Controle de escrita como uma tela o declara: só existe com a permissão. */
function NewExpenseButton() {
    const canWrite = useCan('entries.write');
    return (
        <div>
            <h1>Despesas</h1>
            {canWrite && <button type="button">Nova despesa</button>}
        </div>
    );
}

function renderAs(profile: Profile | null) {
    const client = new QueryClient();
    client.setQueryData(CURRENT_USER_QUERY_KEY, user(profile));
    return render(
        <QueryClientProvider client={client}>
            <NewExpenseButton />
        </QueryClientProvider>,
    );
}

describe('permissions', () => {
    // AC-0009-02: a tabela para os três perfis.
    it.each(Object.keys(TABLE) as Profile[])('can() follows the table for %s', (profile) => {
        for (const permission of PERMISSIONS) {
            expect({ permission, allowed: can(profile, permission) }).toEqual({
                permission,
                allowed: TABLE[profile][permission],
            });
        }
    });

    it('can() is false without a profile', () => {
        for (const permission of PERMISSIONS) {
            expect(can(null, permission)).toBe(false);
            expect(can(undefined, permission)).toBe(false);
        }
    });

    // INV-0009-03: sem permissão, o controle não existe no DOM (nem desabilitado, nem oculto).
    it('does not render the write control for VIEWER', () => {
        const { container } = renderAs('VIEWER');

        expect(screen.getByRole('heading', { name: 'Despesas' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Nova despesa', hidden: true })).toBeNull();
        expect(container.querySelector('button')).toBeNull();
    });

    it('renders the write control for BILLER and ADMIN', () => {
        renderAs('BILLER').unmount();
        renderAs('ADMIN');

        expect(screen.getByRole('button', { name: 'Nova despesa' })).toBeEnabled();
    });

    it('does not render the write control for a user without profile', () => {
        renderAs(null);

        expect(screen.queryByRole('button', { name: 'Nova despesa', hidden: true })).toBeNull();
    });
});
