import { describe, expect, it } from 'vitest';

import { monthOf, today } from '@/shared/dates';

import {
    earningDetailSearchSchema,
    earningListParams,
    earningListSearchSchema,
    listMonth,
} from './earning-search';

describe('earningListSearchSchema', () => {
    it('keeps every valid search parameter', () => {
        const search = {
            mes: '2026-10',
            status: 'OVERDUE',
            tipo: 'tipo-salario',
            conta: 'conta-corrente',
            natureza: 'FIXED',
            grupo: 'grupo-1',
            novo: 1,
        };
        expect(earningListSearchSchema.parse(search)).toEqual(search);
    });

    // ERR-0014-04: parâmetro inválido é descartado e vale o padrão; os válidos ficam.
    it('drops each invalid parameter on its own', () => {
        expect(
            earningListSearchSchema.parse({
                mes: '2026-13',
                status: 'PAID',
                natureza: 'MONTHLY',
                tipo: '',
                conta: 'conta-corrente',
                novo: 2,
            }),
        ).toEqual({ conta: 'conta-corrente' });
    });

    it('validates the detail parameters the same way', () => {
        expect(earningDetailSearchSchema.parse({ receber: 1, excluir: 'sim' })).toEqual({
            receber: 1,
        });
    });
});

describe('earningListParams', () => {
    // AC-0014-01: o mês vira `from`/`to`.
    it('sends the month range and nothing else without filters', () => {
        expect(earningListParams({ mes: '2026-10' })).toEqual({
            from: '2026-10-01',
            to: '2026-10-31',
        });
    });

    // AC-0014-02: os filtros vão para a consulta com os nomes do contrato.
    it('maps the filters to the API query parameters', () => {
        expect(
            earningListParams({
                mes: '2026-02',
                status: 'RECEIVED',
                tipo: 'tipo-salario',
                conta: 'conta-corrente',
                natureza: 'INSTALLMENT',
            }),
        ).toEqual({
            from: '2026-02-01',
            to: '2026-02-28',
            status: 'RECEIVED',
            earningTypeId: 'tipo-salario',
            bankAccountId: 'conta-corrente',
            kind: 'INSTALLMENT',
        });
    });

    it('ignores the month with a group and lists the whole group', () => {
        expect(earningListParams({ mes: '2026-10', grupo: 'grupo-1', status: 'OPEN' })).toEqual({
            installmentGroupId: 'grupo-1',
            status: 'OPEN',
        });
    });

    it("defaults to today's month", () => {
        expect(listMonth({})).toBe(monthOf(today()));
        expect(listMonth({ mes: '2025-01' })).toBe('2025-01');
    });
});
