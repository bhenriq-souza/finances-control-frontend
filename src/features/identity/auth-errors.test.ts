import { describe, expect, it } from 'vitest';

import {
    AUTH_ERROR_MESSAGES,
    authErrorMessage,
    GENERIC_AUTH_ERROR,
    isUnknownAccount,
} from './auth-errors';

const firebaseError = (code: string) =>
    Object.assign(new Error(`Firebase: Error (${code}).`), { code });

describe('Firebase error catalog (INV-0006-05)', () => {
    it.each([
        ['auth/invalid-credential', 'Email ou senha incorretos.'],
        ['auth/user-not-found', 'Email ou senha incorretos.'],
        ['auth/wrong-password', 'Email ou senha incorretos.'],
        [
            'auth/email-already-in-use',
            'Já existe uma conta com este email. Entre ou redefina a senha.',
        ],
        [
            'auth/popup-blocked',
            'O navegador bloqueou a janela do Google. Permita pop-ups e tente de novo.',
        ],
    ])('maps %s to its pt-BR message (ERR-0006-01, ERR-0006-02)', (code, message) => {
        expect(authErrorMessage(firebaseError(code))).toBe(message);
    });

    it('has messages for the other codes named by the spec', () => {
        for (const code of [
            'auth/too-many-requests',
            'auth/network-request-failed',
            'auth/weak-password',
        ]) {
            expect(AUTH_ERROR_MESSAGES[code]).toEqual(expect.any(String));
        }
    });

    it('never returns the SDK text: unknown codes and non-Firebase errors get the generic message', () => {
        expect(authErrorMessage(firebaseError('auth/unknown-thing'))).toBe(GENERIC_AUTH_ERROR);
        expect(authErrorMessage(firebaseError('constructor'))).toBe(GENERIC_AUTH_ERROR);
        expect(authErrorMessage(new Error('Firebase: raw text'))).toBe(GENERIC_AUTH_ERROR);
        expect(authErrorMessage(null)).toBe(GENERIC_AUTH_ERROR);
        expect(authErrorMessage({ code: 42 })).toBe(GENERIC_AUTH_ERROR);
    });

    it('shows nothing when the user closes or replaces the Google popup (ERR-0006-03)', () => {
        expect(authErrorMessage(firebaseError('auth/popup-closed-by-user'))).toBeNull();
        expect(authErrorMessage(firebaseError('auth/cancelled-popup-request'))).toBeNull();
    });

    it('recognizes the unknown-account code', () => {
        expect(isUnknownAccount(firebaseError('auth/user-not-found'))).toBe(true);
        expect(isUnknownAccount(firebaseError('auth/invalid-credential'))).toBe(false);
    });
});
