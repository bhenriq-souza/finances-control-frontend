import { z } from 'zod';

/** Parâmetros de busca de `/despesas/tipos` (spec 0012): `arquivados`, `novo`, `editar`. */
export interface ExpenseTypesSearch {
    /** `?arquivados=1`: a lista inclui os tipos arquivados. */
    arquivados?: 1;
    /** `?novo=1`: abre o formulário de novo tipo (só com `entries.write`). */
    novo?: 1;
    /** `?editar=<id>`: abre o formulário de renomear o tipo (só com `entries.write`). */
    editar?: string;
}

// O roteador entrega `?novo=1` como o número 1; a string "1" também vale.
const flag = z.union([z.literal(1), z.literal('1')]).transform(() => 1 as const);
const id = z.string().trim().min(1);

/** Valida a busca da rota; parâmetro inválido é descartado (spec 0009, ERR-0012-04). */
export function parseExpenseTypesSearch(search: Record<string, unknown>): ExpenseTypesSearch {
    const result: ExpenseTypesSearch = {};
    const arquivados = flag.safeParse(search.arquivados);
    if (arquivados.success) result.arquivados = arquivados.data;
    const novo = flag.safeParse(search.novo);
    if (novo.success) result.novo = novo.data;
    const editar = id.safeParse(search.editar);
    if (editar.success) result.editar = editar.data;
    return result;
}
