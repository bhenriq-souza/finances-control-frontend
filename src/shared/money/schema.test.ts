import { describe, expect, it } from 'vitest';

import { moneySchema } from './schema';

function messageOf(result: ReturnType<ReturnType<typeof moneySchema>['safeParse']>) {
    return result.success ? undefined : result.error.issues[0]?.message;
}

describe('moneySchema', () => {
    it('transforms the typed text into cents', () => {
        expect(moneySchema().parse('1.234,56')).toBe(123456);
        expect(moneySchema().parse('1234,5')).toBe(123450);
        expect(moneySchema().parse('R$ 0,99')).toBe(99);
    });

    it('reports ERR-0008-01 for empty text', () => {
        expect(messageOf(moneySchema().safeParse('  '))).toBe('Informe o valor.');
    });

    it('reports ERR-0008-02 for text out of the format', () => {
        expect(messageOf(moneySchema().safeParse('12.34'))).toBe('Use o formato 1.234,56.');
        expect(messageOf(moneySchema().safeParse('-10'))).toBe('Use o formato 1.234,56.');
    });

    it('reports ERR-0008-03 above the limit', () => {
        expect(messageOf(moneySchema().safeParse('1.000.000.000.000,00'))).toBe(
            'Valor acima do permitido.',
        );
    });

    it('rejects zero by default and with min positive (ERR-0008-04)', () => {
        expect(messageOf(moneySchema().safeParse('0'))).toBe('O valor precisa ser maior que zero.');
        expect(messageOf(moneySchema({ min: 'positive' }).safeParse('0,00'))).toBe(
            'O valor precisa ser maior que zero.',
        );
    });

    it('accepts zero with min nonnegative', () => {
        expect(moneySchema({ min: 'nonnegative' }).parse('0')).toBe(0);
    });
});
