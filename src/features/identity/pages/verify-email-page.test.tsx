import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { RESEND_COOLDOWN_SECONDS } from './use-resend-verification';
import { VerifyEmailPage } from './verify-email-page';

const USER = { uid: 'u1', email: 'nova@example.com', emailVerified: false };

async function renderIt() {
    const session = fakeSession(USER);
    const onVerified = vi.fn();
    const onSignedOut = vi.fn();
    await renderPage(
        <VerifyEmailPage onVerified={onVerified} onSignedOut={onSignedOut} />,
        session,
    );
    return { session, onVerified, onSignedOut };
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
    mocks.fetchUser.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('verify email page', () => {
    it('shows the account email', async () => {
        await renderIt();
        expect(await screen.findByText('nova@example.com')).toBeInTheDocument();
    });

    it('resends, then disables the button for a minute with a countdown (AC-0006-04, ERR-0006-06)', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const { session } = await renderIt();
        await screen.findByText('nova@example.com');

        fireEvent.click(button('Reenviar email'));

        expect(await screen.findByRole('status')).toHaveTextContent(
            'Enviamos um novo email de verificação.',
        );
        expect(session.sendEmailVerification).toHaveBeenCalledTimes(1);
        expect(button(/Reenviar email/)).toBeDisabled();
        expect(button(/Reenviar email/)).toHaveTextContent(
            `Reenviar email (${RESEND_COOLDOWN_SECONDS} s)`,
        );

        await act(() => vi.advanceTimersByTimeAsync(30_000));
        expect(button(/Reenviar email/)).toHaveTextContent('Reenviar email (30 s)');

        await act(() => vi.advanceTimersByTimeAsync(30_000));
        expect(button('Reenviar email')).toBeEnabled();
    });

    it('shows the catalog message when the resend fails, without the cooldown', async () => {
        const { session } = await renderIt();
        session.sendEmailVerification.mockRejectedValue(
            Object.assign(new Error('raw'), { code: 'auth/too-many-requests' }),
        );

        fireEvent.click(button('Reenviar email'));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
        );
        expect(button('Reenviar email')).toBeEnabled();
    });

    it('"Já verifiquei" reloads the user, refreshes the token and asks /users/me again', async () => {
        mocks.fetchUser.mockResolvedValue({ name: 'Ana', profile: null });
        const { session, onVerified } = await renderIt();

        fireEvent.click(button('Já verifiquei'));

        await waitFor(() => expect(onVerified).toHaveBeenCalled());
        expect(session.reloadUser).toHaveBeenCalled();
        expect(session.getIdToken).toHaveBeenCalledWith(true);
        expect(session.reloadUser.mock.invocationCallOrder[0]).toBeLessThan(
            session.getIdToken.mock.invocationCallOrder[0]!,
        );
        expect(mocks.fetchUser).toHaveBeenCalled();
    });

    it('stays with a warning while the backend still says EMAIL_NOT_VERIFIED', async () => {
        mocks.fetchUser.mockRejectedValue(
            new ApiError({ status: 403, code: 'EMAIL_NOT_VERIFIED' }),
        );
        const { onVerified } = await renderIt();

        fireEvent.click(button('Já verifiquei'));

        expect(await screen.findByRole('status')).toHaveTextContent(
            'Seu email ainda não foi verificado.',
        );
        expect(onVerified).not.toHaveBeenCalled();
    });

    it('shows the catalog message for other failures of the check', async () => {
        mocks.fetchUser.mockRejectedValueOnce(
            new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
        );
        const { session } = await renderIt();

        fireEvent.click(button('Já verifiquei'));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Algo deu errado do nosso lado. Tente de novo em instantes.',
        );

        session.reloadUser.mockRejectedValueOnce(
            Object.assign(new Error('raw'), { code: 'auth/network-request-failed' }),
        );
        fireEvent.click(button('Já verifiquei'));
        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Sem conexão com o servidor. Verifique a rede e tente de novo.',
            ),
        );
    });

    it('signs out', async () => {
        const { session, onSignedOut } = await renderIt();

        fireEvent.click(button('Sair'));

        await waitFor(() => expect(onSignedOut).toHaveBeenCalled());
        expect(session.signOut).toHaveBeenCalled();
    });
});
