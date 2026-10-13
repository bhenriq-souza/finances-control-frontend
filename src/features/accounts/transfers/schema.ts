import { z } from 'zod';

import { dateSchema, optionalDateSchema } from '@/shared/dates';
import { moneySchema } from '@/shared/money';

export const SAME_ACCOUNT_MESSAGE = 'Escolha contas diferentes.';

const required = (message: string) => z.string().trim().min(1, message);

/** Descrição e observações: o que se altera em qualquer status (AC-0018-05). */
export const transferDetailsSchema = z.object({
    description: required('Informe a descrição.'),
    notes: z.string(),
});

export type TransferDetailsValues = z.input<typeof transferDetailsSchema>;

/**
 * O formulário completo: criar e alterar a agendada. Conta, valor e data só existem nele
 * (INV-0018-02); `status` e `completedOn` só são enviados ao criar.
 */
export const transferSchema = transferDetailsSchema
    .extend({
        fromBankAccountId: required('Escolha a conta de origem.'),
        toBankAccountId: required('Escolha a conta de destino.'),
        amount: moneySchema(),
        occurredOn: dateSchema('Informe a data.'),
        status: z.enum(['COMPLETED', 'SCHEDULED']),
        completedOn: optionalDateSchema(),
    })
    // INV-0018-03: origem igual ao destino nunca é enviada.
    .refine((values) => values.fromBankAccountId !== values.toBankAccountId, {
        message: SAME_ACCOUNT_MESSAGE,
        path: ['toBankAccountId'],
    });

/** O que o formulário guarda: tudo texto; o schema converte o valor em centavos. */
export type TransferValues = z.input<typeof transferSchema>;
export type TransferOutput = z.output<typeof transferSchema>;

/** Concluir: a data de conclusão, padrão `today()`. */
export const completeTransferSchema = z.object({
    completedOn: dateSchema('Informe a data de conclusão.'),
});

export type CompleteTransferValues = z.input<typeof completeTransferSchema>;
