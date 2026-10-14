import { z } from 'zod';

/** `?novo=1` e `?editar=<id>` das listas (spec 0011); só têm efeito com `accounts.write`. */
export interface AccountsFormSearch {
    novo?: 1;
    editar?: string;
}

/** Campos do schema de busca das listas; parâmetro inválido é descartado. */
export const listFormSearchShape = {
    novo: z.literal(1).optional().catch(undefined),
    editar: z.string().trim().min(1).optional().catch(undefined),
};

/** `?editar=1` do resumo do cartão; parâmetro inválido é descartado. */
export const cardFormSearchShape = {
    editar: z.literal(1).optional().catch(undefined),
};
