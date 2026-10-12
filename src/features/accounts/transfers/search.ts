import { z } from 'zod';

import { isIsoMonth } from '@/shared/dates';

// Parâmetros de busca das rotas de transferências (spec 0018, "Rotas e navegação"). Parâmetro
// inválido é descartado (spec 0009).

const flag = z.literal(1).optional().catch(undefined);

/** `/transferencias`: `mes`, `status`, `conta`, `novo`. */
export const transfersSearchSchema = z.object({
    mes: z.string().refine(isIsoMonth).optional().catch(undefined),
    status: z.enum(['SCHEDULED', 'COMPLETED']).optional().catch(undefined),
    conta: z.string().min(1).optional().catch(undefined),
    novo: flag,
});

export type TransfersSearch = z.infer<typeof transfersSearchSchema>;

/** `/transferencias/$transferenciaId`: `editar`, `concluir`, `excluir`. */
export const transferDetailSearchSchema = z.object({
    editar: flag,
    concluir: flag,
    excluir: flag,
});

export type TransferDetailSearch = z.infer<typeof transferDetailSearchSchema>;
