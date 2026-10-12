import { z } from 'zod';

import type { Cents } from './cents';
import { parseBRL } from './parse';

export const MONEY_MESSAGES = {
    vazio: 'Informe o valor.',
    formato: 'Use o formato 1.234,56.',
    limite: 'Valor acima do permitido.',
    zero: 'O valor precisa ser maior que zero.',
} as const;

export type MoneySchemaOptions = {
    /**
     * `positive` (padrão, para lançamentos): zero é recusado.
     * `nonnegative`: zero é aceito.
     */
    min?: 'positive' | 'nonnegative';
};

/**
 * Schema zod do campo de dinheiro: recebe o texto digitado e entrega `Cents` por `parseBRL`.
 *
 * API: `moneySchema()` equivale a `moneySchema({ min: 'positive' })`; use
 * `moneySchema({ min: 'nonnegative' })` quando zero for válido (spec 0008).
 */
export function moneySchema({ min = 'positive' }: MoneySchemaOptions = {}) {
    return z.string().transform((text, ctx): Cents => {
        const result = parseBRL(text);
        if (!result.ok) {
            ctx.issues.push({
                code: 'custom',
                message: MONEY_MESSAGES[result.reason],
                input: text,
            });
            return z.NEVER;
        }
        if (min === 'positive' && result.cents === 0) {
            ctx.issues.push({ code: 'custom', message: MONEY_MESSAGES.zero, input: text });
            return z.NEVER;
        }
        return result.cents;
    });
}
