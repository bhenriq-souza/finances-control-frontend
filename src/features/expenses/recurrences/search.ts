import { z } from 'zod';

/** `/series/despesas/$serieId`: `encerrar` abre o diálogo de encerrar (spec 0017). */
export const expenseRecurrenceSearchSchema = z.object({
    encerrar: z.literal(1).optional().catch(undefined),
});

export type ExpenseRecurrenceSearch = z.infer<typeof expenseRecurrenceSearchSchema>;
