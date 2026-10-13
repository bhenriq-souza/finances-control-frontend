import { z } from 'zod';

import { dateSchema, optionalDateSchema } from '@/shared/dates';

import { parsePaymentMethod } from './expense-action-model';

/** **Pagar**: a data do pagamento, padrão `today()`. */
export const paySchema = z.object({
    paidOn: dateSchema('Informe a data do pagamento.'),
});

export type PayValues = z.infer<typeof paySchema>;

export const METHOD_REQUIRED_MESSAGE = 'Escolha a conta ou o cartão.';
export const POSTED_BEFORE_PURCHASE_MESSAGE = 'A fatura não pode ser anterior à data da compra.';

/**
 * **Trocar forma de pagamento**: o destino (`conta:<id>` ou `cartao:<id>`), a fatura opcional
 * (só com cartão, não anterior a `occurredOn`) e o escopo numa série.
 */
export function paymentMethodSchema(occurredOn: string) {
    return z
        .object({
            method: z
                .string()
                .refine((value) => parsePaymentMethod(value) !== null, METHOD_REQUIRED_MESSAGE),
            postedOn: optionalDateSchema(),
            scope: z.enum(['single', 'following']),
        })
        .refine(
            ({ method, postedOn }) =>
                parsePaymentMethod(method)?.kind !== 'cartao' ||
                postedOn === '' ||
                postedOn >= occurredOn,
            { message: POSTED_BEFORE_PURCHASE_MESSAGE, path: ['postedOn'] },
        );
}

export type PaymentMethodValues = z.infer<ReturnType<typeof paymentMethodSchema>>;
