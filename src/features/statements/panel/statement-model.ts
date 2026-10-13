import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import type { components } from '@/api/generated/schema';
import { ENTRY_STALE_TIME, queryKeys } from '@/api/queries/keys';
import { addDays, addMonths, monthOf, monthRange, type IsoDate } from '@/shared/dates';

export type Statement = components['schemas']['StatementResponse'];
export type StatementExpense = components['schemas']['StatementExpenseResponse'];
export type StatementRefund = components['schemas']['CreditCardRefundResponse'];
export type StatementPayment = components['schemas']['StatementPaymentResponse'];

// Cada parâmetro é validado sozinho e, inválido, descartado (spec 0009): os demais continuam.
const flag = z.literal(1).optional().catch(undefined);

/**
 * Parâmetros de busca de `/cartoes/$cartaoId` que são das faturas (spec 0013, "Rotas"): cada um
 * abre o diálogo da ação (pagamento em T-0013-02, estorno em T-0013-03), só com `entries.write`.
 */
export const statementsPanelSearchSchema = z.object({
    pagar: flag,
    estorno: flag,
    /** A despesa de origem do estorno, junto com `estorno`. */
    despesa: z.uuid().optional().catch(undefined),
});

export type StatementsPanelSearch = z.infer<typeof statementsPanelSearchSchema>;

/** Parâmetros de busca de `/cartoes/$cartaoId/faturas/$faturaId` (spec 0013, "Rotas"). */
export const statementDetailSearchSchema = z.object({
    pagar: flag,
    minimo: flag,
    estorno: flag,
});

export type StatementDetailSearch = z.infer<typeof statementDetailSearchSchema>;

function required<T>(data: T | undefined): T {
    if (data === undefined) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
    return data;
}

/** O erro de uma consulta como `ApiError`, para a mensagem do catálogo; outro erro é inesperado. */
export function asApiError(error: Error): ApiError {
    return error instanceof ApiError
        ? error
        : new ApiError({ status: 0, code: 'UNEXPECTED_RESPONSE' });
}

/** `GET /statements/current?creditCardId=…`, chave `['statements', 'current', id]`. */
export function currentStatementQuery(creditCardId: string) {
    return queryOptions({
        queryKey: queryKeys.statements.current(creditCardId),
        queryFn: async (): Promise<Statement> =>
            required(
                unwrap(
                    await api.GET('/statements/current', {
                        params: { query: { creditCardId } },
                    }),
                ).data,
            ),
        staleTime: ENTRY_STALE_TIME,
    });
}

/** A janela de `GET /statements`; sem ela, as fechadas dos últimos 12 meses e a aberta. */
export interface StatementWindow {
    from: IsoDate;
    to: IsoDate;
}

/** `GET /statements?creditCardId=…[&from&to]`, chave `['statements', 'list', id, janela]`. */
export function statementsListQuery(creditCardId: string, window?: StatementWindow) {
    return queryOptions({
        queryKey: queryKeys.statements.list(creditCardId, window ? { ...window } : undefined),
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

/** `GET /statements/{id}`, chave `['statements', 'detail', id]`. */
export function statementDetailQuery(id: string) {
    return queryOptions({
        queryKey: queryKeys.statements.detail(id),
        queryFn: async (): Promise<Statement> =>
            required(unwrap(await api.GET('/statements/{id}', { params: { path: { id } } })).data),
        staleTime: ENTRY_STALE_TIME,
    });
}

/** O mesmo dia do mês `n` meses depois, limitado ao último dia do mês de destino. */
function addMonthsToDate(date: IsoDate, n: number): IsoDate {
    const { to: lastDay } = monthRange(addMonths(monthOf(date), n));
    const candidate = `${lastDay.slice(0, 8)}${date.slice(8)}`;
    return candidate < lastDay ? candidate : lastDay;
}

/**
 * Janela das próximas faturas (spec 0013, "Painel de faturas"): do dia seguinte ao `closesOn` da
 * fatura atual até 12 meses depois dele.
 */
export function upcomingWindow(currentClosesOn: IsoDate): StatementWindow {
    return { from: addDays(currentClosesOn, 1), to: addMonthsToDate(currentClosesOn, 12) };
}

/**
 * Faturas anteriores: as persistidas (com `id`) da lista sem janela, sem a aberta, em ordem
 * decrescente de `closesOn`.
 */
export function previousStatements(
    statements: readonly Statement[],
): (Statement & { id: string })[] {
    return statements
        .filter((statement): statement is Statement & { id: string } => statement.id !== null)
        .sort((a, b) => b.closesOn.localeCompare(a.closesOn));
}

/** Próximas faturas, em ordem crescente de `closesOn`. */
export function upcomingStatements(statements: readonly Statement[]): Statement[] {
    return [...statements].sort((a, b) => a.closesOn.localeCompare(b.closesOn));
}

/** A rota do detalhe de uma fatura persistida (INV-0013-03: a projetada não tem). */
export function statementHref(creditCardId: string, statementId: string): string {
    return `/cartoes/${creditCardId}/faturas/${statementId}`;
}
