import { describe, expect, it } from 'vitest';

import { initials } from './initials';

describe('initials', () => {
    it('uses the first and the last word of the name', () => {
        expect(initials('Ana Souza', 'ana@example.com')).toBe('AS');
        expect(initials('  maria da  silva ', 'm@example.com')).toBe('MS');
    });

    it('uses a single letter for a single-word name', () => {
        expect(initials('Ana', 'ana@example.com')).toBe('A');
    });

    it('falls back to the email without a name', () => {
        expect(initials('   ', 'bruno@example.com')).toBe('B');
    });
});
