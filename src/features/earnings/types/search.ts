import { z } from 'zod';

/** `?x=1`: o roteador entrega `1` (número); um `'1'` literal também vale. */
const flag = z
    .union([z.literal(1), z.literal('1')])
    .transform(() => 1 as const)
    .optional()
    .catch(undefined);

const id = z.string().trim().min(1).optional().catch(undefined);

const schema = z.object({ arquivados: flag, novo: flag, editar: id });

/** Parâmetros de busca de `/receitas/tipos` (spec 0014): `arquivados`, `novo`, `editar`. */
export interface EarningTypesSearch {
    /** Mostra também os tipos arquivados. */
    arquivados?: 1;
    /** Abre o formulário de novo tipo (só com `entries.write`). */
    novo?: 1;
    /** Abre o formulário de renomear o tipo com esse id (só com `entries.write`). */
    editar?: string;
}

/**
 * `validateSearch` da rota: cada parâmetro inválido é descartado e vale o padrão (ERR-0014-04),
 * e os ausentes ficam fora do objeto.
 */
export function parseEarningTypesSearch(raw: Record<string, unknown>): EarningTypesSearch {
    const parsed = schema.parse(raw);
    const search: EarningTypesSearch = {};
    if (parsed.arquivados) search.arquivados = parsed.arquivados;
    if (parsed.novo) search.novo = parsed.novo;
    if (parsed.editar) search.editar = parsed.editar;
    return search;
}
