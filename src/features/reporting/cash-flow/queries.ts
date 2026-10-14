import { queryOptions } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import { ENTRY_STALE_TIME, queryKeys } from '@/api/queries/keys';
import { monthRange, type IsoMonth } from '@/shared/dates';

import type { BankTransfer, Earning, Expense, Statement } from './cash-flow-model';
import { statementWindow } from './cash-flow-model';

// As consultas do fluxo de caixa (spec 0015) que o dashboard e os relatórios ainda não têm, com as
// mesmas chaves das outras telas (spec 0009), para que o cache seja um só. O saldo vem de
// `reports/`. Com uma conta escolhida (revisão de 2026-10-14), as listas levam `bankAccountId`;
// sem ela, o parâmetro fica de fora e a chave é a mesma das listas e do dashboard.

function required<T>(data: T | undefined): T {
    if (data === undefined) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
    return data;
}

/** `GET /earnings?from&to[&bankAccountId]` do mês, todos os status. */
export function monthEarningsQuery(month: IsoMonth, bankAccountId?: string) {
    const query = { ...monthRange(month), ...(bankAccountId ? { bankAccountId } : {}) };
    return queryOptions({
        queryKey: queryKeys.earnings.list(query),
        queryFn: async (): Promise<Earning[]> =>
            required(unwrap(await api.GET('/earnings', { params: { query } })).data),
        staleTime: ENTRY_STALE_TIME,
    });
}

/** `GET /expenses?from&to[&bankAccountId]` do mês, todos os status. */
export function monthExpensesQuery(month: IsoMonth, bankAccountId?: string) {
    const query = { ...monthRange(month), ...(bankAccountId ? { bankAccountId } : {}) };
    return queryOptions({
        queryKey: queryKeys.expenses.list(query),
        queryFn: async (): Promise<Expense[]> =>
            required(unwrap(await api.GET('/expenses', { params: { query } })).data),
        staleTime: ENTRY_STALE_TIME,
    });
}

/** `GET /earnings?status=OVERDUE[&bankAccountId]`: as receitas vencidas de qualquer mês. */
export function overdueEarningsQuery(bankAccountId?: string) {
    const query = { status: 'OVERDUE' as const, ...(bankAccountId ? { bankAccountId } : {}) };
    return queryOptions({
        queryKey: queryKeys.earnings.list(query),
        queryFn: async (): Promise<Earning[]> =>
            required(unwrap(await api.GET('/earnings', { params: { query } })).data),
        staleTime: ENTRY_STALE_TIME,
    });
}

/** `GET /expenses?status=OVERDUE[&bankAccountId]`: as despesas vencidas de qualquer mês. */
export function overdueExpensesQuery(bankAccountId?: string) {
    const query = { status: 'OVERDUE' as const, ...(bankAccountId ? { bankAccountId } : {}) };
    return queryOptions({
        queryKey: queryKeys.expenses.list(query),
        queryFn: async (): Promise<Expense[]> =>
            required(unwrap(await api.GET('/expenses', { params: { query } })).data),
        staleTime: ENTRY_STALE_TIME,
    });
}

/**
 * `GET /bank-transfers?bankAccountId&from&to` do mês, todos os status: as transferências que
 * saem ou entram na conta escolhida. `reporting` não importa `accounts` (INV-0015-06); a chave
 * é a mesma da lista de transferências.
 */
export function monthTransfersQuery(bankAccountId: string, month: IsoMonth) {
    const query = { ...monthRange(month), bankAccountId };
    return queryOptions({
        queryKey: queryKeys.bankTransfers.list(query),
        queryFn: async (): Promise<BankTransfer[]> =>
            required(unwrap(await api.GET('/bank-transfers', { params: { query } })).data),
        staleTime: ENTRY_STALE_TIME,
    });
}

/** `GET /bank-transfers?bankAccountId&status=SCHEDULED`: as agendadas da conta, de qualquer mês. */
export function scheduledTransfersQuery(bankAccountId: string) {
    const query = { bankAccountId, status: 'SCHEDULED' as const };
    return queryOptions({
        queryKey: queryKeys.bankTransfers.list(query),
        queryFn: async (): Promise<BankTransfer[]> =>
            required(unwrap(await api.GET('/bank-transfers', { params: { query } })).data),
        staleTime: ENTRY_STALE_TIME,
    });
}

/** `GET /statements?creditCardId&from=<1º dia de mes−2>&to=<último dia de mes>`. */
export function monthStatementsQuery(creditCardId: string, month: IsoMonth) {
    const window = statementWindow(month);
    return queryOptions({
        queryKey: queryKeys.statements.list(creditCardId, window),
        queryFn: async (): Promise<Statement[]> =>
            required(
                unwrap(
                    await api.GET('/statements', {
                        params: { query: { creditCardId, ...window } },
                    }),
                ).data,
            ),
        staleTime: ENTRY_STALE_TIME,
    });
}
