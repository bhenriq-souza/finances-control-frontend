import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { fakeSession, renderPage } from '../test-utils';

import { PASSWORD_RESET_SENT, PasswordResetPage } from './password-reset-page';

const firebaseError = (code: string) => Object.assign(new Error('raw'), { code });

function submit(email = 'ana@example.com') {
    fireEvent.input(screen.getByLabelText('Email'), { target: { value: email } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }));
}

describe('password reset page', () => {
    it('sends the reset email and confirms', async () => {
        const session = fakeSession();
        await renderPage(<PasswordResetPage />, session);

        submit();

        expect(await screen.findByRole('status')).toHaveTextContent(PASSWORD_RESET_SENT);
        expect(session.sendPasswordReset).toHaveBeenCalledWith('ana@example.com');
    });

    it('confirms the same way when the account does not exist', async () => {
        const session = fakeSession();
        session.sendPasswordReset.mockRejectedValue(firebaseError('auth/user-not-found'));
        await renderPage(<PasswordResetPage />, session);

        submit();

        expect(await screen.findByRole('status')).toHaveTextContent(PASSWORD_RESET_SENT);
    });

    it('shows the catalog message for other failures', async () => {
        const session = fakeSession();
        session.sendPasswordReset.mockRejectedValue(firebaseError('auth/network-request-failed'));
        await renderPage(<PasswordResetPage />, session);

        submit();

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Sem conexão com o servidor. Verifique a rede e tente de novo.',
        );
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('validates the email before calling the provider', async () => {
        const session = fakeSession();
        await renderPage(<PasswordResetPage />, session);

        submit('nao-e-email');

        expect(await screen.findByText('Informe um email válido.')).toBeInTheDocument();
        expect(session.sendPasswordReset).not.toHaveBeenCalled();
    });
});
