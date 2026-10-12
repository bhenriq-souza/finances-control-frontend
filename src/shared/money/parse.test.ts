import { describe, expect, it } from 'vitest';

import { parseBRL } from './parse';

describe('parseBRL', () => {
    // AC-0008-01
    it.each([
        ['1.234,56', 123456],
        ['R$ 1.234,56', 123456],
        ['R$1.234,56', 123456],
        ['  R$   1.234,56  ', 123456],
        ['1234,56', 123456],
        ['1,5', 150],
        [',99', 99],
        ['0,99', 99],
        ['1', 100],
        ['1234', 123400],
        ['1234,5', 123450],
        ['1.234', 123400],
        ['1.234.567,89', 123456789],
        ['0', 0],
    ])('AC-0008-01: %j -> %i centavos', (text, cents) => {
        expect(parseBRL(text)).toEqual({ ok: true, cents });
    });

    it.each([
        '12.34',
        '1,234',
        '1.2345,00',
        '-10',
        '+10',
        '1e3',
        'abc',
        '1,',
        'R$',
        '.234',
        '1..234',
    ])('AC-0008-01: %j -> formato', (text) => {
        expect(parseBRL(text)).toEqual({ ok: false, reason: 'formato' });
    });

    it.each(['', '   '])('AC-0008-01: %j -> vazio', (text) => {
        expect(parseBRL(text)).toEqual({ ok: false, reason: 'vazio' });
    });

    // AC-0008-02
    it('AC-0008-02: aceita o limite 999.999.999.999,99', () => {
        expect(parseBRL('999.999.999.999,99')).toEqual({ ok: true, cents: 99_999_999_999_999 });
    });

    it('AC-0008-02: acima do limite -> limite', () => {
        expect(parseBRL('1.000.000.000.000,00')).toEqual({ ok: false, reason: 'limite' });
        expect(parseBRL('1000000000000')).toEqual({ ok: false, reason: 'limite' });
    });

    it('zeros à esquerda não contam para o limite', () => {
        expect(parseBRL('0000000000000001,00')).toEqual({ ok: true, cents: 100 });
    });
});
