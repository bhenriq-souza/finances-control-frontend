import { z } from 'zod';

/** `/series/receitas/$serieId`: `encerrar` abre o diálogo de encerrar (spec 0017). */
export const earningRecurrenceSearchSchema = z.object({
    encerrar: z.literal(1).optional().catch(undefined),
});

export type EarningRecurrenceSearch = z.infer<typeof earningRecurrenceSearchSchema>;
