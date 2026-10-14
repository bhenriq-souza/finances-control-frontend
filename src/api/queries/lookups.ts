import { useMemo } from 'react';

import { useBankAccounts, useCreditCards } from './reference';

export const REMOVED_ACCOUNT_LABEL = 'Conta removida';
export const REMOVED_CARD_LABEL = 'Cartão removido';

export interface Lookup {
    /** Rótulo por id, com os arquivados inclusos. */
    labels: ReadonlyMap<string, string>;
    /**
     * Rótulo do id; para id ausente da consulta, o rótulo de removido (ERR-0009-06). Enquanto a
     * consulta não tem dado, devolve texto vazio em vez de afirmar que o item foi removido.
     */
    label: (id: string) => string;
    /** A consulta de referência já tem dado. */
    isReady: boolean;
}

function buildLookup<T extends { id: string }>(
    items: readonly T[] | undefined,
    labelOf: (item: T) => string,
    removed: string,
): Lookup {
    const labels = new Map<string, string>();
    for (const item of items ?? []) labels.set(item.id, labelOf(item));
    const isReady = items !== undefined;
    return {
        labels,
        label: (id) => labels.get(id) ?? (isReady ? removed : ''),
        isReady,
    };
}

/** Contas por id, rotuladas pela descrição (spec 0009, "Dados compartilhados entre features"). */
export function useAccountLookup(): Lookup {
    const { data } = useBankAccounts();
    return useMemo(
        () => buildLookup(data, (account) => account.description, REMOVED_ACCOUNT_LABEL),
        [data],
    );
}

/** Cartões por id, rotulados pelo nome. */
export function useCardLookup(): Lookup {
    const { data } = useCreditCards();
    return useMemo(() => buildLookup(data, (card) => card.name, REMOVED_CARD_LABEL), [data]);
}
