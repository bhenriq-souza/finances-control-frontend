import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api/errors/api-error';

const mocks = vi.hoisted(() => ({ fetchUser: vi.fn() }));
vi.mock('@/api/client', () => ({
    api: {
        GET: async () => ({
            data: { data: (await mocks.fetchUser()) as unknown },
            response: new Response(null, { status: 200 }),
        }),
    },
}));

import { fakeSession, renderPage } from '../test-utils';

import { PendingApprovalPage, STILL_PENDING } from './pending-approval-page';

const USER = { uid: 'u1', email: 'a@b.c', emailVerified: true };
const me = (profile: string | null) => ({ name: 'Ana', profile });

async function renderIt() {
    const session = fakeSession(USER);
    const onApproved = vi.fn();
    const onSignedOut = vi.fn();
    await renderPage(
        <PendingApprovalPage onApproved={onApproved} onSignedOut={onSignedOut} />,
        session,
    );
    return { session, onApproved, onSignedOut };
}

const checkAgain = () => fireEvent.click(screen.getByRole('button', { name: 'Verificar de novo' }));

beforeEach(() => {
    mocks.fetchUser.mockReset();
});

describe('pending approval page', () => {
    it('stays with a notice while there is no profile, then goes on once there is (AC-0006-03)', async () => {
        mocks.fetchUser.mockResolvedValueOnce(me(null)).mockResolvedValueOnce(me('VIEWER'));
        const { onApproved } = await renderIt();

        checkAgain();
        expect(await screen.findByRole('status')).toHaveTextContent(STILL_PENDING);
        expect(onApproved).not.toHaveBeenCalled();

        checkAgain();
        await waitFor(() => expect(onApproved).toHaveBeenCalledTimes(1));
        expect(mocks.fetchUser).toHaveBeenCalledTimes(2);
    });

    it('shows the catalog message when the check fails', async () => {
        mocks.fetchUser.mockRejectedValueOnce(new ApiError({ status: 0, code: 'NETWORK_ERROR' }));
        await renderIt();

        checkAgain();

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Sem conexão com o servidor. Verifique a rede e tente de novo.',
        );
    });

    it('shows a generic message for an unexpected failure', async () => {
        mocks.fetchUser.mockRejectedValueOnce(new TypeError('boom'));
        await renderIt();

        checkAgain();

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Não foi possível concluir agora. Tente de novo em instantes.',
        );
    });

    it('signs out', async () => {
        const { session, onSignedOut } = await renderIt();

        fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

        await waitFor(() => expect(onSignedOut).toHaveBeenCalled());
        expect(session.signOut).toHaveBeenCalled();
    });
});
