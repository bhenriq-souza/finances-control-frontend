import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api/errors/api-error';
import { CURRENT_USER_QUERY_KEY } from '@/api/queries/current-user';

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

import {
    EMAIL_NOT_VERIFIED_WARNING,
    PendingApprovalPage,
    STILL_PENDING,
} from './pending-approval-page';
import { RESEND_COOLDOWN_SECONDS } from './use-resend-verification';

const USER = { uid: 'u1', email: 'a@b.c', emailVerified: true };
const me = (profile: string | null, emailVerified = true) => ({
    name: 'Ana',
    profile,
    emailVerified,
});

/** Monta a página com `/users/me` já no cache, como a guarda de `_app` deixa. */
async function renderIt({ emailVerified = true } = {}) {
    const session = fakeSession(USER);
    const onApproved = vi.fn();
    const onSignedOut = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, me(null, emailVerified) as never);
    await renderPage(
        <PendingApprovalPage onApproved={onApproved} onSignedOut={onSignedOut} />,
        session,
        queryClient,
    );
    return { session, onApproved, onSignedOut };
}

const resendButton = () => screen.queryByRole('button', { name: /Reenviar email/ });

const checkAgain = () => fireEvent.click(screen.getByRole('button', { name: 'Verificar de novo' }));

beforeEach(() => {
    mocks.fetchUser.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
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

    it('"Verificar de novo" reloads the user and refreshes the token before asking /users/me (AC-0006-12)', async () => {
        const order: string[] = [];
        mocks.fetchUser.mockImplementationOnce(() => {
            order.push('users/me');
            return Promise.resolve(me('VIEWER'));
        });
        const { session, onApproved } = await renderIt();
        session.reloadUser.mockImplementationOnce(() => {
            order.push('reloadUser');
            return Promise.resolve(USER);
        });
        session.getIdToken.mockImplementationOnce((forceRefresh?: boolean) => {
            order.push(`getIdToken:${String(forceRefresh)}`);
            return Promise.resolve('tok');
        });

        checkAgain();

        await waitFor(() => expect(onApproved).toHaveBeenCalledTimes(1));
        expect(order).toEqual(['reloadUser', 'getIdToken:true', 'users/me']);
    });

    it('with emailVerified true there is no warning and no "Reenviar email" (AC-0006-12)', async () => {
        await renderIt({ emailVerified: true });

        expect(screen.queryByText(EMAIL_NOT_VERIFIED_WARNING)).not.toBeInTheDocument();
        expect(resendButton()).not.toBeInTheDocument();
    });

    it('with emailVerified false warns and resends, then waits a minute (AC-0006-12, ERR-0006-06)', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const { session } = await renderIt({ emailVerified: false });

        expect(screen.getByText(EMAIL_NOT_VERIFIED_WARNING)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Reenviar email' }));

        expect(await screen.findByRole('status')).toHaveTextContent(
            'Enviamos um novo email de verificação.',
        );
        expect(session.sendEmailVerification).toHaveBeenCalledTimes(1);
        expect(resendButton()).toBeDisabled();
        expect(resendButton()).toHaveTextContent(`Reenviar email (${RESEND_COOLDOWN_SECONDS} s)`);

        await vi.advanceTimersByTimeAsync(RESEND_COOLDOWN_SECONDS * 1000);

        await waitFor(() => expect(resendButton()).toBeEnabled());
        expect(resendButton()).toHaveTextContent(/^Reenviar email$/);
    });

    it('shows the catalog message when resending fails', async () => {
        const { session } = await renderIt({ emailVerified: false });
        session.sendEmailVerification.mockRejectedValueOnce(
            Object.assign(new Error('Firebase: raw'), { code: 'auth/too-many-requests' }),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Reenviar email' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
        );
        expect(resendButton()).toBeEnabled();
    });

    it('hides the warning once "Verificar de novo" sees the email verified', async () => {
        mocks.fetchUser.mockResolvedValueOnce(me(null, true));
        await renderIt({ emailVerified: false });
        expect(screen.getByText(EMAIL_NOT_VERIFIED_WARNING)).toBeInTheDocument();

        checkAgain();

        expect(await screen.findByRole('status')).toHaveTextContent(STILL_PENDING);
        expect(screen.queryByText(EMAIL_NOT_VERIFIED_WARNING)).not.toBeInTheDocument();
        expect(resendButton()).not.toBeInTheDocument();
    });
});
