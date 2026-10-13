import { z } from 'zod';

import { isIsoDate } from './iso';

export const INVALID_DATE_MESSAGE = 'Data inválida.';

/**
 * Data obrigatória de formulário (spec 0009, `DateField`): vazio dá `requiredMessage`; qualquer
 * coisa que não seja um `YYYY-MM-DD` existente dá "Data inválida.".
 */
export function dateSchema(requiredMessage: string) {
    return z.string().superRefine((value, ctx) => {
        if (value === '') {
            ctx.addIssue({ code: 'custom', message: requiredMessage });
        } else if (!isIsoDate(value)) {
            ctx.addIssue({ code: 'custom', message: INVALID_DATE_MESSAGE });
        }
    });
}

/**
 * Valida a data opcional de um campo que pode sumir do formulário (**Fatura de** só com cartão,
 * **Repetir até** só em Fixa, conclusão só na transferência concluída): chame só quando o campo
 * aparece, para que um texto inválido deixado num campo escondido não trave o envio.
 */
export function refineOptionalDate(ctx: z.RefinementCtx, path: string, value: string) {
    if (value !== '' && !isIsoDate(value)) {
        ctx.addIssue({ code: 'custom', path: [path], message: INVALID_DATE_MESSAGE });
    }
}

/** Data opcional de formulário: `''` (vazio) ou um `YYYY-MM-DD` existente. */
export function optionalDateSchema() {
    return z.string().refine((value) => value === '' || isIsoDate(value), INVALID_DATE_MESSAGE);
}
