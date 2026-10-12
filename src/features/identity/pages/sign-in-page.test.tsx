import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { fakeSession, renderPage } from '../test-utils';

import { SignInPage } from './sign-in-page';

const firebaseError = (code: string) =>
    Object.assign(new Error(`Firebase: Error (${code}).`), { code });

function fillAndSubmit(email = 'ana@example.com', password = 'segredo') {
    fireEvent.input(screen.getByLabelText('Email'), { target: { value: email } });
    fireEvent.input(screen.getByLabelText('Senha'), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('sign-in page', () => {
    it('signs in with email and password, then calls onSignedIn', async () => {
        const session = fakeSession();
        const onSignedIn = vi.fn();
        await renderPage(<SignInPage onSignedIn={onSignedIn} />, session);

        fillAndSubmit();

        await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
        expect(session.signInWithEmail).toHaveBeenCalledWith('ana@example.com', 'segredo');
    });

    it('keeps the email and clears the password on wrong credentials (ERR-0006-01)', async () => {
        const session = fakeSession();
        session.signInWithEmail.mockRejectedValue(firebaseError('auth/invalid-credential'));
        const onSignedIn = vi.fn();
        await renderPage(<SignInPage onSignedIn={onSignedIn} />, session);

        fillAndSubmit();

        expect(await screen.findByRole('alert')).toHaveTextContent('Email ou senha incorretos.');
        expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com');
        expect(screen.getByLabelText('Senha')).toHaveValue('');
        expect(onSignedIn).not.toHaveBeenCalled();
        expect(screen.queryByText(/Firebase/)).not.toBeInTheDocument();
    });

    it('signs in with Google; a blocked popup shows the catalog message (ERR-0006-02)', async () => {
        const session = fakeSession();
        session.signInWithGoogle.mockRejectedValueOnce(firebaseError('auth/popup-blocked'));
        const onSignedIn = vi.fn();
        await renderPage(<SignInPage onSignedIn={onSignedIn} />, session);

        fireEvent.click(screen.getByRole('button', { name: 'Entrar com Google' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'O navegador bloqueou a janela do Google. Permita pop-ups e tente de novo.',
        );

        fireEvent.click(screen.getByRole('button', { name: 'Entrar com Google' }));
        await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows nothing when the Google popup is closed by the user (ERR-0006-03)', async () => {
        const session = fakeSession();
        session.signInWithGoogle.mockRejectedValue(firebaseError('auth/popup-closed-by-user'));
        await renderPage(<SignInPage onSignedIn={vi.fn()} />, session);

        fireEvent.click(screen.getByRole('button', { name: 'Entrar com Google' }));

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Entrar com Google' })).toBeEnabled(),
        );
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('links to sign-up and password reset', async () => {
        await renderPage(<SignInPage onSignedIn={vi.fn()} />, fakeSession());

        expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
            'href',
            '/criar-conta',
        );
        expect(screen.getByRole('link', { name: 'Esqueci a senha' })).toHaveAttribute(
            'href',
            '/redefinir-senha',
        );
    });
});
