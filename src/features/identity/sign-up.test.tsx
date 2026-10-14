import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as string[]);
const failures = vi.hoisted(() => new Map<string, Error>());
const step = (name: string) => {
    const failure = failures.get(name);
    return failure ? Promise.reject(failure) : Promise.resolve();
};
const newUser = vi.hoisted(() => ({ uid: 'novo' }));

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
    GoogleAuthProvider: class {},
    browserLocalPersistence: 'local',
    getAuth: vi.fn(() => ({ currentUser: null })),
    setPersistence: vi.fn(() => Promise.resolve()),
    createUserWithEmailAndPassword: vi.fn((_auth: unknown, email: string, password: string) => {
        calls.push(`create:${email}:${password}`);
        return step('create').then(() => ({ user: newUser }));
    }),
    updateProfile: vi.fn((user: unknown, profile: { displayName: string }) => {
        calls.push(`updateProfile:${user === newUser}:${profile.displayName}`);
        return step('updateProfile');
    }),
    sendEmailVerification: vi.fn((user: unknown) => {
        calls.push(`sendEmailVerification:${user === newUser}`);
        return step('sendEmailVerification');
    }),
}));

import { resetRuntimeConfigForTests } from '@/shared/config';

import { createFirebaseAuthClient } from './auth-client/firebase-auth-client';
import { SignUpPage } from './pages/sign-up-page';
import { fakeSession, renderPage } from './test-utils';

beforeEach(() => {
    calls.length = 0;
    failures.clear();
});

function firebaseError(code: string) {
    return Object.assign(new Error('Firebase: raw'), { code });
}

function firebaseClient() {
    resetRuntimeConfigForTests();
    window.__FTECH_CONFIG__ = {
        environment: 'local',
        firebase: { apiKey: 'k', authDomain: 'd', projectId: 'p', appId: 'a' },
    };
    const client = createFirebaseAuthClient();
    delete window.__FTECH_CONFIG__;
    return client;
}

function fill(label: string, value: string) {
    fireEvent.input(screen.getByLabelText(label), { target: { value } });
}

function fillValidForm() {
    fill('Nome', '  Ana Souza ');
    fill('Email', 'ana@example.com');
    fill('Senha', '12345678');
    fill('Confirme a senha', '12345678');
}

describe('sign-up (AC-0006-05)', () => {
    it('creates the account, then updates the name, then sends the verification email', async () => {
        resetRuntimeConfigForTests();
        window.__FTECH_CONFIG__ = {
            environment: 'local',
            firebase: { apiKey: 'k', authDomain: 'd', projectId: 'p', appId: 'a' },
        };

        await createFirebaseAuthClient().signUpWithEmail('Ana', 'ana@example.com', '12345678');

        expect(calls).toEqual([
            'create:ana@example.com:12345678',
            'updateProfile:true:Ana',
            'sendEmailVerification:true',
        ]);
        delete window.__FTECH_CONFIG__;
    });

    it('the page submits the trimmed name and leads to the _app guard', async () => {
        const session = fakeSession();
        const onSignedUp = vi.fn();
        await renderPage(<SignUpPage onSignedUp={onSignedUp} />, session);

        fillValidForm();
        fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

        await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
        expect(session.signUpWithEmail).toHaveBeenCalledWith(
            'Ana Souza',
            'ana@example.com',
            '12345678',
        );
    });

    it('validates the fields in pt-BR, linking each error to its input', async () => {
        const session = fakeSession();
        await renderPage(<SignUpPage onSignedUp={vi.fn()} />, session);

        fill('Senha', '1234567');
        fill('Confirme a senha', 'outra');
        fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

        expect(await screen.findByText('Informe seu nome.')).toBeInTheDocument();
        expect(screen.getByText('Informe um email válido.')).toBeInTheDocument();
        expect(
            screen.getByText('A senha precisa ter pelo menos 8 caracteres.'),
        ).toBeInTheDocument();
        expect(screen.getByText('As senhas não conferem.')).toBeInTheDocument();
        const name = screen.getByLabelText('Nome');
        expect(name).toHaveAttribute('aria-invalid', 'true');
        expect(name).toHaveAccessibleDescription('Informe seu nome.');
        expect(session.signUpWithEmail).not.toHaveBeenCalled();
    });

    it('shows the catalog message when the email is taken, and stays on the page', async () => {
        const session = fakeSession();
        session.signUpWithEmail.mockRejectedValue(
            Object.assign(new Error('Firebase: raw'), { code: 'auth/email-already-in-use' }),
        );
        const onSignedUp = vi.fn();
        await renderPage(<SignUpPage onSignedUp={onSignedUp} />, session);

        fillValidForm();
        fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Já existe uma conta com este email. Entre ou redefina a senha.',
        );
        expect(onSignedUp).not.toHaveBeenCalled();
        expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
    });
});

describe('sign-up after the account exists (AC-0006-11)', () => {
    it.each(['updateProfile', 'sendEmailVerification'])(
        'a failure of %s does not reject, and the remaining steps still run',
        async (failing) => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
            failures.set(failing, firebaseError('auth/too-many-requests'));

            await expect(
                firebaseClient().signUpWithEmail('Ana', 'ana@example.com', '12345678'),
            ).resolves.toBeUndefined();

            expect(calls).toEqual([
                'create:ana@example.com:12345678',
                'updateProfile:true:Ana',
                'sendEmailVerification:true',
            ]);
            expect(warn).toHaveBeenCalledTimes(1);
            warn.mockRestore();
        },
    );

    it('a failure of the account creation rejects and stops there', async () => {
        failures.set('create', firebaseError('auth/email-already-in-use'));

        await expect(
            firebaseClient().signUpWithEmail('Ana', 'ana@example.com', '12345678'),
        ).rejects.toMatchObject({ code: 'auth/email-already-in-use' });

        expect(calls).toEqual(['create:ana@example.com:12345678']);
    });
});
