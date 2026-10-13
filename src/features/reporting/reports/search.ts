import { z } from 'zod';

import { isIsoMonth } from '@/shared/dates';

import { REPORT_TABS } from './period';

// Cada parâmetro inválido é descartado sozinho e vale o padrão (ERR-0015-02).
const optional = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

/** Parâmetros de busca de `/relatorios` (spec 0015): a aba e o período `de`/`ate` (`YYYY-MM`). */
export const reportsSearchSchema = z.object({
    aba: optional(z.enum(REPORT_TABS)),
    de: optional(z.string().refine(isIsoMonth)),
    ate: optional(z.string().refine(isIsoMonth)),
});

export type ReportsSearch = z.infer<typeof reportsSearchSchema>;
