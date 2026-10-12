import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthClient, AuthUser } from '../auth-client';
import { SpikePage } from './spike-page';

let listener: (user: AuthUser | null) => void;
const client: AuthClient = {
    onAuthStateChanged: vi.fn((next) => {
        listener = next;
        next(null);
        return () => undefined;
    }),
    signInWithEmail: vi.fn(() => Promise.resolve()),
    signInWithGoogle: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => Promise.resolve()),
    getIdToken: vi.fn(() => Promise.resolve('tok')),
};

vi.mock('../auth-client', () => ({ getAuthClient: () => client }));

const USER: AuthUser = { uid: 'u1', email: 'a@b.c', emailVerified: false };

describe('SpikePage', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(new Response('{"id":"u1"}', { status: 403 }))),
        );
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('signs in by email and password through the port', () => {
        render(<SpikePage />);
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } });
        fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'pw' } });
        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

        expect(client.signInWithEmail).toHaveBeenCalledWith('a@b.c', 'pw');
    });

    it('signs in with Google through the port', () => {
        render(<SpikePage />);
        fireEvent.click(screen.getByRole('button', { name: 'Entrar com Google' }));

        expect(client.signInWithGoogle).toHaveBeenCalled();
    });

    it('shows the raw error code and message when sign-in fails', async () => {
        vi.mocked(client.signInWithGoogle).mockRejectedValueOnce(
            Object.assign(new Error('Firebase: popup closed'), { code: 'auth/popup-closed' }),
        );
        render(<SpikePage />);
        fireEvent.click(screen.getByRole('button', { name: 'Entrar com Google' }));

        expect(await screen.findByTestId('spike-error')).toHaveTextContent(
            'auth/popup-closed: Firebase: popup closed',
        );
    });

    it('shows a non-Error rejection without a code', async () => {
        vi.mocked(client.signOut).mockRejectedValueOnce('boom');
        render(<SpikePage />);
        act(() => listener(USER));
        fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));

        expect(await screen.findByTestId('spike-error')).toHaveTextContent('sem-codigo: boom');
    });

    it('shows the user and the raw status and body of /api/users/me with the bearer token', async () => {
        render(<SpikePage />);
        act(() => listener(USER));

        expect(await screen.findByTestId('spike-email')).toHaveTextContent('a@b.c');
        expect(screen.getByTestId('spike-email-verified')).toHaveTextContent('false');
        await waitFor(() => {
            expect(screen.getByTestId('spike-me-status')).toHaveTextContent('403');
        });
        expect(screen.getByTestId('spike-me-body')).toHaveTextContent('{"id":"u1"}');
        expect(fetch).toHaveBeenCalledWith('/api/users/me', {
            headers: { Authorization: 'Bearer tok' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
        expect(client.signOut).toHaveBeenCalled();
    });

    it('shows the error when the request itself fails', async () => {
        vi.mocked(fetch).mockRejectedValueOnce(new TypeError('network down'));
        render(<SpikePage />);
        act(() => listener(USER));

        expect(await screen.findByTestId('spike-error')).toHaveTextContent('network down');
    });
});
