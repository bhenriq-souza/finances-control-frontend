import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
    it('joins conditional classes and lets the last conflicting utility win', () => {
        const disabled = false;
        expect(cn('p-2 text-sm', disabled && 'opacity-50', 'p-4')).toBe('text-sm p-4');
    });
});
