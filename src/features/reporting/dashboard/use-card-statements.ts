import { useQueries, type UseQueryResult } from '@tanstack/react-query';

import type { CreditCard } from '@/api/queries/reference';

import type { Statement } from './dashboard-data';
import { cardStatementsQuery } from './dashboard-queries';

export interface CardStatements {
    card: CreditCard;
    query: UseQueryResult<Statement[]>;
}

/**
 * As faturas de cada cartão ativo (`GET /statements?creditCardId`, uma consulta por cartão). As
 * seções "Vence esta semana" e "Contas e cartões" leem as mesmas consultas, pela mesma chave.
 */
export function useCardStatements(cards: readonly CreditCard[]): CardStatements[] {
    const queries = useQueries({ queries: cards.map((card) => cardStatementsQuery(card.id)) });
    return cards.map((card, index) => ({ card, query: queries[index]! }));
}
