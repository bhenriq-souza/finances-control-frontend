import { describe, expect, it } from 'vitest';

import { reportsSearchSchema } from './search';
import { defaultPeriod, PERIOD_MESSAGES, periodError, resolvePeriod } from './period';

describe('defaultPeriod (spec 0015)', () => {
    it('is −5 to +6 for saldo, the current month for por-tipo and −5 to now for fluxo', () => {
        expect(defaultPeriod('saldo', '2026-10')).toEqual({ from: '2026-05', to: '2027-04' });
        expect(defaultPeriod('por-tipo', '2026-10')).toEqual({ from: '2026-10', to: '2026-10' });
        expect(defaultPeriod('fluxo', '2026-02')).toEqual({ from: '2025-09', to: '2026-02' });
    });

    it('defaults to the month of today()', () => {
        const { from, to } = defaultPeriod('por-tipo');
        expect(from).toMatch(/^\d{4}-\d{2}$/);
        expect(to).toBe(from);
    });
});

// AC-0015-09: período com `de` maior que `ate` não chega à API.
describe('periodError', () => {
    it('accepts de ≤ ate within 120 months', () => {
        expect(periodError('2026-10', '2026-10')).toBeNull();
        expect(periodError('2016-11', '2026-10')).toBeNull();
    });

    it('rejects de after ate', () => {
        expect(periodError('2026-11', '2026-10')).toBe(PERIOD_MESSAGES.order);
        expect(periodError('2027-01', '2026-12')).toBe(PERIOD_MESSAGES.order);
    });

    it('rejects more than 120 months, like the API', () => {
        expect(periodError('2016-10', '2026-10')).toBe(PERIOD_MESSAGES.tooLong);
    });

    it('rejects a missing or malformed month', () => {
        expect(periodError('', '2026-10')).toBe(PERIOD_MESSAGES.required);
        expect(periodError('2026-10', undefined)).toBe(PERIOD_MESSAGES.required);
        expect(periodError('2026-13', '2026-10')).toBe(PERIOD_MESSAGES.required);
    });
});

// ERR-0015-02: período inválido na URL é descartado e vale o padrão da aba.
describe('resolvePeriod', () => {
    it('keeps a valid period from the URL', () => {
        expect(resolvePeriod('fluxo', { de: '2026-01', ate: '2026-03' }, '2026-10')).toEqual({
            from: '2026-01',
            to: '2026-03',
        });
    });

    it('fills a missing end from the tab default', () => {
        expect(resolvePeriod('saldo', { de: '2026-08' }, '2026-10')).toEqual({
            from: '2026-08',
            to: '2027-04',
        });
        expect(resolvePeriod('por-tipo', { ate: '2026-12' }, '2026-10')).toEqual({
            from: '2026-10',
            to: '2026-12',
        });
    });

    it('discards de after ate, and a window over 120 months, for the tab default', () => {
        expect(resolvePeriod('saldo', { de: '2026-12', ate: '2026-10' }, '2026-10')).toEqual(
            defaultPeriod('saldo', '2026-10'),
        );
        expect(resolvePeriod('fluxo', { de: '2000-01', ate: '2026-10' }, '2026-10')).toEqual(
            defaultPeriod('fluxo', '2026-10'),
        );
        // Só `ate` antes do padrão de `de` também é descartado.
        expect(resolvePeriod('por-tipo', { ate: '2026-01' }, '2026-10')).toEqual(
            defaultPeriod('por-tipo', '2026-10'),
        );
    });
});

describe('reportsSearchSchema', () => {
    it('keeps valid params and drops invalid ones one by one', () => {
        expect(reportsSearchSchema.parse({ aba: 'fluxo', de: '2026-01', ate: '2026-03' })).toEqual({
            aba: 'fluxo',
            de: '2026-01',
            ate: '2026-03',
        });
        expect(reportsSearchSchema.parse({ aba: 'outra', de: '2026-1', ate: '2026-03' })).toEqual({
            aba: undefined,
            de: undefined,
            ate: '2026-03',
        });
    });
});
