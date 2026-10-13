import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    addDays,
    addMonths,
    dateInputToValue,
    dateSchema,
    formatDate,
    formatMonth,
    isIsoDate,
    isIsoMonth,
    maskDateInput,
    monthOf,
    monthRange,
    optionalDateSchema,
    today,
    valueToDateInput,
} from './index';

function at(instant: string) {
    vi.setSystemTime(new Date(instant));
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
});

afterEach(() => {
    vi.useRealTimers();
});

describe('today (AC-0009-03, INV-0009-05)', () => {
    it('returns the São Paulo date when UTC is already the next day', () => {
        at('2026-10-12T02:30:00Z');
        expect(today()).toBe('2026-10-11');
    });

    it('turns the day at midnight in São Paulo (03:00 UTC)', () => {
        at('2026-10-12T02:59:59Z');
        expect(today()).toBe('2026-10-11');
        at('2026-10-12T03:00:00Z');
        expect(today()).toBe('2026-10-12');
    });

    it('always returns a valid YYYY-MM-DD', () => {
        at('2027-01-01T02:00:00Z');
        expect(today()).toBe('2026-12-31');
        expect(isIsoDate(today())).toBe(true);
    });
});

describe('isIsoDate / isIsoMonth', () => {
    it.each(['2026-10-15', '2024-02-29', '0001-01-01'])('accepts %s', (value) => {
        expect(isIsoDate(value)).toBe(true);
    });

    it.each([
        '2026-02-29',
        '2026-13-01',
        '2026-00-10',
        '2026-10-00',
        '2026-10-32',
        '2026-1-05',
        '2026-10-15T00:00:00Z',
        '',
        20261015,
        null,
    ])('rejects %s', (value) => {
        expect(isIsoDate(value)).toBe(false);
    });

    it.each(['2026-10', '2026-01', '2026-12'])('accepts month %s', (value) => {
        expect(isIsoMonth(value)).toBe(true);
    });

    it.each(['2026-13', '2026-00', '2026-1', '2026-10-01', undefined])(
        'rejects month %s',
        (value) => {
            expect(isIsoMonth(value)).toBe(false);
        },
    );
});

describe('calendar arithmetic', () => {
    it.each([
        ['2026-10-15', 1, '2026-10-16'],
        ['2026-10-31', 1, '2026-11-01'],
        ['2026-12-31', 1, '2027-01-01'],
        ['2026-03-01', -1, '2026-02-28'],
        ['2024-02-28', 1, '2024-02-29'],
        ['2026-10-15', 0, '2026-10-15'],
        ['2026-10-15', -365, '2025-10-15'],
    ] as const)('addDays(%s, %i) = %s', (date, n, expected) => {
        expect(addDays(date, n)).toBe(expected);
    });

    it('is not shifted by daylight-saving or the device time zone', () => {
        // O horário de verão de 2018 em São Paulo começou em 4 de novembro.
        expect(addDays('2018-11-03', 1)).toBe('2018-11-04');
        expect(addDays('2018-11-04', 1)).toBe('2018-11-05');
    });

    it('addDays(n) then addDays(-n) is the identity', () => {
        const date = fc
            .date({
                min: new Date('1900-01-01T00:00:00Z'),
                max: new Date('2200-12-31T00:00:00Z'),
                noInvalidDate: true,
            })
            .map((d) => d.toISOString().slice(0, 10));
        fc.assert(
            fc.property(date, fc.integer({ min: -5000, max: 5000 }), (d, n) => {
                expect(addDays(addDays(d, n), -n)).toBe(d);
            }),
        );
    });

    it.each([
        ['2026-10', 1, '2026-11'],
        ['2026-12', 1, '2027-01'],
        ['2026-01', -1, '2025-12'],
        ['2026-10', -22, '2024-12'],
        ['2026-10', 27, '2029-01'],
        ['2026-10', 0, '2026-10'],
    ] as const)('addMonths(%s, %i) = %s', (month, n, expected) => {
        expect(addMonths(month, n)).toBe(expected);
    });

    it('monthOf returns the YYYY-MM of a date', () => {
        expect(monthOf('2026-10-15')).toBe('2026-10');
    });

    it.each([
        ['2026-10', '2026-10-01', '2026-10-31'],
        ['2026-02', '2026-02-01', '2026-02-28'],
        ['2024-02', '2024-02-01', '2024-02-29'],
        ['2026-04', '2026-04-01', '2026-04-30'],
    ] as const)('monthRange(%s) = %s..%s', (month, from, to) => {
        expect(monthRange(month)).toEqual({ from, to });
    });

    it('rejects malformed input instead of guessing', () => {
        expect(() => addDays('2026-02-30', 1)).toThrow(RangeError);
        expect(() => monthOf('15/10/2026')).toThrow(RangeError);
        expect(() => addMonths('2026-13', 1)).toThrow(RangeError);
        expect(() => monthRange('2026')).toThrow(RangeError);
    });
});

describe('formatDate (AC-0009-03)', () => {
    beforeEach(() => at('2026-10-15T15:00:00Z'));

    it('formats the short and long styles', () => {
        expect(formatDate('2026-10-15', 'curta')).toBe('15 out.');
        expect(formatDate('2026-10-15', 'longa')).toBe('15 de out. de 2026');
        expect(formatDate('2026-05-01', 'curta')).toBe('1 mai.');
        expect(formatDate('2027-01-09', 'longa')).toBe('9 de jan. de 2027');
    });

    it('formats the relative style against today()', () => {
        expect(formatDate('2026-10-15', 'relativa')).toBe('Hoje');
        expect(formatDate('2026-10-14', 'relativa')).toBe('Ontem');
        expect(formatDate('2026-10-16', 'relativa')).toBe('Amanhã');
        expect(formatDate('2026-10-20', 'relativa')).toBe('20 out.');
    });

    it('uses the São Paulo day for "Hoje" late at night', () => {
        at('2026-10-16T02:30:00Z');
        expect(formatDate('2026-10-15', 'relativa')).toBe('Hoje');
    });
});

describe('formatMonth', () => {
    it.each([
        ['2026-10', 'outubro de 2026'],
        ['2026-03', 'março de 2026'],
        ['2027-01', 'janeiro de 2027'],
    ] as const)('formatMonth(%s) = %s', (month, expected) => {
        expect(formatMonth(month)).toBe(expected);
    });
});

describe('DateField mask (AC-0009-12)', () => {
    it.each([
        ['', ''],
        ['0', '0'],
        ['05', '05'],
        ['051', '05/1'],
        ['0511', '05/11'],
        ['05112', '05/11/2'],
        ['05112026', '05/11/2026'],
        ['051120269', '05/11/2026'],
        ['05/11/2026', '05/11/2026'],
        ['05/', '05'],
        ['ab05-1x1', '05/11'],
        ['2026-11-05', '05/11/2026'],
        [' 2026-11-05 ', '05/11/2026'],
    ])('maskDateInput(%j) = %j', (raw, expected) => {
        expect(maskDateInput(raw)).toBe(expected);
    });

    it.each([
        ['05/11/2026', '2026-11-05'],
        ['29/02/2024', '2024-02-29'],
        ['', ''],
        ['31/02/2026', '31/02/2026'],
        ['05/11/20', '05/11/20'],
        ['05/13/2026', '05/13/2026'],
    ])('dateInputToValue(%j) = %j', (text, expected) => {
        expect(dateInputToValue(text)).toBe(expected);
    });

    it.each([
        ['2026-11-05', '05/11/2026'],
        ['', ''],
        [undefined, ''],
        [null, ''],
        ['05/11/20', '05/11/20'],
    ])('valueToDateInput(%j) = %j', (value, expected) => {
        expect(valueToDateInput(value)).toBe(expected);
    });

    it('round-trips every existing date through the mask', () => {
        fc.assert(
            fc.property(
                fc.date({
                    min: new Date('1900-01-01'),
                    max: new Date('2999-12-31'),
                    noInvalidDate: true,
                }),
                (date) => {
                    const iso = date.toISOString().slice(0, 10);
                    const typed = valueToDateInput(iso).replace(/\D/g, '');
                    expect(dateInputToValue(maskDateInput(typed))).toBe(iso);
                    expect(dateInputToValue(maskDateInput(iso))).toBe(iso);
                },
            ),
        );
    });
});

describe('dateSchema / optionalDateSchema (AC-0009-12)', () => {
    const required = dateSchema('Informe a data.');
    const optional = optionalDateSchema();
    const message = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
        result.error?.issues.map((issue) => issue.message);

    it('accepts an existing YYYY-MM-DD', () => {
        expect(required.parse('2026-11-05')).toBe('2026-11-05');
        expect(optional.parse('2024-02-29')).toBe('2024-02-29');
    });

    it('asks for the date when empty, and only the optional accepts empty', () => {
        expect(message(required.safeParse(''))).toEqual(['Informe a data.']);
        expect(optional.parse('')).toBe('');
    });

    it.each(['31/02/2026', '05/11/20', '2026-02-29', '2026-13-01', '05/11/2026', 'x'])(
        'rejects %j with "Data inválida."',
        (value) => {
            expect(message(required.safeParse(value))).toEqual(['Data inválida.']);
            expect(message(optional.safeParse(value))).toEqual(['Data inválida.']);
        },
    );
});
