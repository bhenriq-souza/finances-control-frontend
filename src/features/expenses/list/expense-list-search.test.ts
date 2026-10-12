import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get } }));

import { ApiError } from '@/api/errors/api-error';
import { queryKeys } from '@/api/queries/keys';

import {
    asApiError,
    expenseListQuery,
    expenseListSearchSchema,
    expensesQuery,
    listMonth,
} from './expense-list-search';
import { ACCOUNT_ID, CARD_ID, expenseFixture, GROUP_ID, TYPE_ID } from './expense-test-data';

const response = (status: number, body: unknown) => ({
    data: status < 400 ? body : undefined,
    error: status < 400 ? undefined : body,
    response: { ok: status < 400, status },
});

beforeEach(() => {
    mocks.get.mockReset();
});

describe('expense list search (spec 0012)', () => {
    it('keeps every valid parameter', () => {
        const search = {
            mes: '2026-10',
            status: 'OVERDUE',
            tipo: TYPE_ID,
            conta: ACCOUNT_ID,
            cartao: CARD_ID,
            natureza: 'INSTALLMENT',
            grupo: GROUP_ID,
            novo: 1,
        };
        expect(expenseListSearchSchema.parse(search)).toEqual(search);
    });

    // ERR-0012-04: cada parâmetro inválido é descartado sozinho; vale o padrão.
    it('drops each invalid parameter and keeps the others', () => {
        expect(
            expenseListSearchSchema.parse({
                mes: '2026-13',
                status: 'LATE',
                tipo: 'not-a-uuid',
                conta: 42,
                natureza: 'ONCE',
                novo: 'sim',
                cartao: CARD_ID,
            }),
        ).toEqual({ cartao: CARD_ID });
        expect(listMonth(expenseListSearchSchema.parse({ mes: '2026-13' }))).toMatch(
            /^\d{4}-\d{2}$/,
        );
    });

    // AC-0012-01 e AC-0012-02: o mês vira `from`/`to`; os filtros, os parâmetros do contrato.
    it('maps the month and the filters to the GET /expenses query', () => {
        expect(expenseListQuery({ mes: '2026-10' })).toEqual({
            from: '2026-10-01',
            to: '2026-10-31',
        });
        expect(
            expenseListQuery({
                mes: '2026-02',
                status: 'OVERDUE',
                natureza: 'FIXED',
                tipo: TYPE_ID,
                conta: ACCOUNT_ID,
                cartao: CARD_ID,
            }),
        ).toEqual({
            from: '2026-02-01',
            to: '2026-02-28',
            status: 'OVERDUE',
            kind: 'FIXED',
            expenseTypeId: TYPE_ID,
            bankAccountId: ACCOUNT_ID,
            creditCardId: CARD_ID,
        });
    });

    it('ignores the month when listing a whole installment group', () => {
        expect(expenseListQuery({ mes: '2026-10', grupo: GROUP_ID, status: 'OPEN' })).toEqual({
            installmentGroupId: GROUP_ID,
            status: 'OPEN',
        });
    });

    it('queries GET /expenses with exactly the filters, under the list key', async () => {
        const data = [expenseFixture()];
        mocks.get.mockResolvedValue(response(200, { data }));
        const query = { from: '2026-10-01', to: '2026-10-31', status: 'OVERDUE' } as const;
        const options = expensesQuery(query);

        expect(options.queryKey).toEqual(queryKeys.expenses.list(query));
        await expect(new QueryClient().fetchQuery(options)).resolves.toEqual(data);
        expect(mocks.get).toHaveBeenCalledWith('/expenses', { params: { query } });
    });

    it('fails with the catalogue error, or UNEXPECTED_RESPONSE without data', async () => {
        mocks.get.mockResolvedValueOnce(
            response(500, { error: { code: 'INTERNAL_ERROR', message: 'boom' } }),
        );
        await expect(new QueryClient().fetchQuery(expensesQuery({}))).rejects.toMatchObject({
            code: 'INTERNAL_ERROR',
        });
        mocks.get.mockResolvedValueOnce(response(200, {}));
        await expect(new QueryClient().fetchQuery(expensesQuery({}))).rejects.toMatchObject({
            code: 'UNEXPECTED_RESPONSE',
        });
    });

    it('turns any error into an ApiError with a catalogue message', () => {
        const apiError = new ApiError({ status: 404, code: 'EXPENSE_NOT_FOUND' });
        expect(asApiError(apiError)).toBe(apiError);
        expect(asApiError(new Error('x'))).toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
    });
});
