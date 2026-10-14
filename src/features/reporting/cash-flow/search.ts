import { z } from 'zod';

import { isIsoMonth, monthOf, today, type IsoMonth } from '@/shared/dates';

/** Os valores de `?situacao=` do fluxo de caixa (spec 0015), na ordem do filtro. */
export const SITUATIONS = ['realizados', 'a-vencer', 'vencidos'] as const;
export type Situation = (typeof SITUATIONS)[number];

/** As ações que `?acao=` aceita; a rota as traduz para as de cada feature (INV-0015-06). */
export const CASH_FLOW_ACTIONS = ['pagar', 'receber', 'editar', 'excluir', 'desfazer'] as const;
export type CashFlowAction = (typeof CASH_FLOW_ACTIONS)[number];

// Cada parâmetro é validado sozinho e, inválido, descartado (ERR-0015-02): os demais continuam.
const optional = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);
const id = z.string().trim().min(1).max(64);

/** Parâmetros de busca de `/fluxo-de-caixa` (spec 0015, "Fluxo de caixa"). */
export const cashFlowSearchSchema = z.object({
    /** `YYYY-MM`; ausente ou inválido, vale o mês de `today()`. */
    mes: optional(z.string().refine((value) => isIsoMonth(value))),
    /** Filtro de situação; ausente, todos. */
    situacao: optional(z.enum(SITUATIONS)),
    /** Diálogo de ação aberto sobre a tela, com o alvo em `despesa`, `receita` ou `fatura`. */
    acao: optional(z.enum(CASH_FLOW_ACTIONS)),
    despesa: optional(id),
    receita: optional(id),
    fatura: optional(id),
    /** O cartão da fatura, junto com `fatura`. */
    cartao: optional(id),
});

export type CashFlowSearch = z.infer<typeof cashFlowSearchSchema>;

/** O mês do fluxo de caixa: o da URL ou o de `today()`. */
export function cashFlowMonth(search: Pick<CashFlowSearch, 'mes'>): IsoMonth {
    return search.mes ?? monthOf(today());
}
