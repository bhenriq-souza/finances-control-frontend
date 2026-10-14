import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { MAX_CENTS } from './cents';
import { formatBRL } from './format';
import { parseBRL } from './parse';

describe('roundtrip', () => {
    // AC-0008-04, INV-0008-02
    it('AC-0008-04: parseBRL(formatBRL(c, never)) === c em 10.000 valores aleatórios', () => {
        fc.assert(
            fc.property(fc.integer({ min: 0, max: MAX_CENTS }), (cents) => {
                expect(parseBRL(formatBRL(cents, { sign: 'never' }))).toEqual({ ok: true, cents });
            }),
            { numRuns: 10_000 },
        );
    });

    it('AC-0008-04: limites', () => {
        for (const cents of [0, 1, 99, 100, 99_999, 100_000, MAX_CENTS - 1, MAX_CENTS]) {
            expect(parseBRL(formatBRL(cents, { sign: 'never' }))).toEqual({ ok: true, cents });
        }
    });
});
