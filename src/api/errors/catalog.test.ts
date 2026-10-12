import { describe, expect, it } from 'vitest';

import { CLIENT_ERROR_MESSAGES, ERROR_MESSAGES } from './catalog';

describe('error catalog', () => {
    it('has a non-empty pt-BR message for each of the 55 contract codes (AC-0005-05)', () => {
        const entries = Object.entries(ERROR_MESSAGES);
        expect(entries).toHaveLength(55);
        for (const [code, message] of entries) {
            expect(message.trim(), code).not.toBe('');
            expect(message, code).not.toContain(code);
        }
    });

    it('has the client error messages from the spec', () => {
        expect(CLIENT_ERROR_MESSAGES).toEqual({
            NETWORK_ERROR: 'Sem conexão com o servidor. Verifique a rede e tente de novo.',
            UNEXPECTED_RESPONSE:
                'O servidor respondeu de um jeito inesperado. Tente de novo em instantes.',
        });
    });
});
