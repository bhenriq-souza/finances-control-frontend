import { z } from 'zod';

import type { operations } from '@/api/generated/schema';
import { isIsoMonth, monthOf, monthRange, today, type IsoMonth } from '@/shared/dates';

import { EARNING_KINDS, EARNING_STATUSES } from './earning-model';

// Cada parâmetro inválido é descartado sozinho e vale o padrão (ERR-0014-04).
const optional = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

const id = z.string().trim().min(1).max(64);

/** Parâmetros de busca de `/receitas` (spec 0014, "Rotas e navegação"). */
export const earningListSearchSchema = z.object({
    mes: optional(z.string().refine(isIsoMonth)),
    status: optional(z.enum(EARNING_STATUSES)),
    tipo: optional(id),
    conta: optional(id),
    natureza: optional(z.enum(EARNING_KINDS)),
    grupo: optional(id),
    novo: optional(z.literal(1)),
});

/** Query de `GET /earnings`, pelo contrato. */
export type EarningListQuery = NonNullable<operations['listEarnings']['parameters']['query']>;

export type EarningListSearch = z.infer<typeof earningListSearchSchema>;

/** Parâmetros de busca de `/receitas/$receitaId`; as ações são das tarefas seguintes. */
export const earningDetailSearchSchema = z.object({
    editar: optional(z.literal(1)),
    receber: optional(z.literal(1)),
    excluir: optional(z.literal(1)),
});

export type EarningDetailSearch = z.infer<typeof earningDetailSearchSchema>;

/** O mês da lista: o da URL ou, sem ele, o de `today()`. */
export function listMonth(search: Pick<EarningListSearch, 'mes'>): IsoMonth {
    return search.mes ?? monthOf(today());
}

/**
 * Os parâmetros de `GET /earnings` para a busca: `from`/`to` do mês e os filtros presentes. Com
 * `grupo`, o mês é ignorado e a lista mostra o parcelamento inteiro.
 */
export function earningListParams(search: EarningListSearch): EarningListQuery {
    const params: EarningListQuery = search.grupo
        ? { installmentGroupId: search.grupo }
        : monthRange(listMonth(search));
    if (search.status) params.status = search.status;
    if (search.natureza) params.kind = search.natureza;
    if (search.tipo) params.earningTypeId = search.tipo;
    if (search.conta) params.bankAccountId = search.conta;
    return params;
}
