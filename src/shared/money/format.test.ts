import { describe, expect, it } from 'vitest';

import { formatBRL } from './format';

describe('formatBRL', () => {
    // AC-0008-03
    it('AC-0008-03: formata positivos', () => {
        expect(formatBRL(123456)).toBe('R$ 1.234,56');
    });

    it('AC-0008-03: sinal de menos U+2212 antes do R$ para negativos', () => {
        expect(formatBRL(-1230)).toBe('−R$ 12,30');
    });

    it('AC-0008-03: sign always', () => {
        expect(formatBRL(1230, { sign: 'always' })).toBe('+R$ 12,30');
        expect(formatBRL(-1230, { sign: 'always' })).toBe('−R$ 12,30');
        expect(formatBRL(0, { sign: 'always' })).toBe('R$ 0,00');
    });

    it('sign never devolve o valor absoluto', () => {
        expect(formatBRL(-1230, { sign: 'never' })).toBe('R$ 12,30');
        expect(formatBRL(1230, { sign: 'never' })).toBe('R$ 12,30');
    });

    it('AC-0008-03: limite máximo', () => {
        expect(formatBRL(99_999_999_999_999)).toBe('R$ 999.999.999.999,99');
        expect(formatBRL(-99_999_999_999_999)).toBe('−R$ 999.999.999.999,99');
    });

    it('valores pequenos mantêm duas casas', () => {
        expect(formatBRL(0)).toBe('R$ 0,00');
        expect(formatBRL(1)).toBe('R$ 0,01');
        expect(formatBRL(99)).toBe('R$ 0,99');
        expect(formatBRL(100)).toBe('R$ 1,00');
    });

    it('-0 formata como R$ 0,00', () => {
        expect(formatBRL(-0)).toBe('R$ 0,00');
        expect(formatBRL(-0, { sign: 'always' })).toBe('R$ 0,00');
    });

    it('nunca emite NBSP (U+00A0) nem NBSP estreito (U+202F)', () => {
        for (const cents of [0, 1, 123456, -123456, 99_999_999_999_999]) {
            expect(formatBRL(cents)).not.toContain(String.fromCharCode(0x00a0));
            expect(formatBRL(cents)).not.toContain(String.fromCharCode(0x202f));
        }
        expect(formatBRL(100)).toContain('R$ 1');
    });

    // ERR-0008-05
    it.each([
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        99_999_999_999_999 + 1,
        -(99_999_999_999_999 + 1),
    ])('ERR-0008-05: %s lança RangeError', (value) => {
        expect(() => formatBRL(value)).toThrow(RangeError);
    });
});
