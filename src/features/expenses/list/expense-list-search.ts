import { queryOptions, useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import { ENTRY_STALE_TIME, queryKeys } from '@/api/queries/keys';
import { isIsoMonth, monthRange, type IsoMonth } from '@/shared/dates';

import {
    currentMonth,
    EXPENSE_KINDS,
    EXPENSE_STATUSES,
    type Expense,
    type ExpenseListQuery,
} from './expense-model';

// Cada parâmetro é validado sozinho e, inválido, descartado (ERR-0012-04): os demais continuam.
const uuid = z.uuid().optional().catch(undefined);
const flag = z.literal(1).optional().catch(undefined);

/** Parâmetros de busca de `/despesas` (spec 0012, "Rotas e navegação"). */
export const expenseListSearchSchema = z.object({
    /** `YYYY-MM`; ausente ou inválido, vale o mês de `today()`. */
    mes: z
        .string()
        .refine((value) => isIsoMonth(value))
        .optional()
        .catch(undefined),
    status: z.enum(EXPENSE_STATUSES).optional().catch(undefined),
    tipo: uuid,
    conta: uuid,
    cartao: uuid,
    natureza: z.enum(EXPENSE_KINDS).optional().catch(undefined),
    /** Um parcelamento inteiro; com ele, o mês é ignorado. */
    grupo: uuid,
    /** Abre o formulário de nova despesa (T-0012-02). */
    novo: flag,
    /** Ações rápidas de uma linha: o id da despesa; abrem o diálogo sobre a lista (T-0012-06). */
    pagar: uuid,
    editar: uuid,
    excluir: uuid,
    desfazer: uuid,
});

export type ExpenseListSearch = z.infer<typeof expenseListSearchSchema>;

/** Os filtros removíveis da lista, na ordem em que as etiquetas aparecem. */
export const FILTER_KEYS = ['status', 'tipo', 'conta', 'cartao', 'natureza', 'grupo'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/** O mês da lista: o da URL ou o de `today()`. */
export function listMonth(search: ExpenseListSearch): IsoMonth {
    return search.mes ?? currentMonth();
}

/**
 * A consulta de `GET /expenses` para os filtros da URL: `from`/`to` do mês e, quando presentes, os
 * demais filtros. Com `grupo`, o mês é ignorado e a lista mostra o parcelamento inteiro.
 */
export function expenseListQuery(search: ExpenseListSearch): ExpenseListQuery {
    const query: ExpenseListQuery = search.grupo
        ? { installmentGroupId: search.grupo }
        : { ...monthRange(listMonth(search)) };
    if (search.status) query.status = search.status;
    if (search.natureza) query.kind = search.natureza;
    if (search.tipo) query.expenseTypeId = search.tipo;
    if (search.conta) query.bankAccountId = search.conta;
    if (search.cartao) query.creditCardId = search.cartao;
    return query;
}

/** `GET /expenses` com exatamente os filtros enviados, chave `queryKeys.expenses.list(filtros)`. */
export function expensesQuery(query: ExpenseListQuery) {
    return queryOptions({
        queryKey: queryKeys.expenses.list(query),
        queryFn: async (): Promise<Expense[]> => {
            const body = unwrap(await api.GET('/expenses', { params: { query } }));
            if (!body.data) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
            return body.data;
        },
        staleTime: ENTRY_STALE_TIME,
    });
}

/** O erro de uma consulta como `ApiError`, para a mensagem do catálogo (INV-0000-06). */
export function asApiError(error: unknown): ApiError {
    return error instanceof ApiError
        ? error
        : new ApiError({ status: 0, code: 'UNEXPECTED_RESPONSE' });
}

export const useExpenses = (query: ExpenseListQuery) => useQuery(expensesQuery(query));
