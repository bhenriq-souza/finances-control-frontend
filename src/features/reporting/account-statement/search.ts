import { z } from 'zod';

import { isIsoMonth, monthOf, today, type IsoMonth } from '@/shared/dates';

/** `?mes=YYYY-MM` do extrato; inválido é descartado (ERR-0015-02). */
export const accountStatementSearchSchema = z.object({
    mes: z
        .string()
        .refine((value) => isIsoMonth(value))
        .optional()
        .catch(undefined),
});

export type AccountStatementSearch = z.infer<typeof accountStatementSearchSchema>;

/** O mês do extrato: o da URL ou o de `today()`. */
export function statementMonth(search: AccountStatementSearch): IsoMonth {
    return search.mes ?? monthOf(today());
}
