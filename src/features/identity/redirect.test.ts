import { describe, expect, it } from 'vitest';

import { safeRedirect } from './redirect';

describe('sign-in redirect sanitizer (INV-0006-06)', () => {
    it.each(['/', '/contas', '/contas/123?aba=extrato#topo', '/aguardando-aprovacao'])(
        'keeps the internal path %s',
        (path) => {
            expect(safeRedirect(path)).toBe(path);
        },
    );

    it.each([
        '//exemplo.com',
        '///exemplo.com',
        'https://exemplo.com/',
        'http://exemplo.com',
        'javascript:alert(1)',
        'contas',
        '/\\exemplo.com',
        '/ /exemplo.com',
        '/\t/exemplo.com',
        '',
    ])('turns the external or malformed %j into / (ERR-0006-07)', (value) => {
        expect(safeRedirect(value)).toBe('/');
    });

    it('turns a missing or non-string value into /', () => {
        expect(safeRedirect(undefined)).toBe('/');
        expect(safeRedirect(['/contas'])).toBe('/');
    });
});
