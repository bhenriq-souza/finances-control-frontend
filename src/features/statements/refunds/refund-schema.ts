import { z } from 'zod';

import { dateSchema, optionalDateSchema } from '@/shared/dates';
import { moneySchema } from '@/shared/money';

import type { StatementRefund } from '../panel/statement-model';

import type { CreateRefund, UpdateRefund } from './refund-api';

/** Limites do contrato (spec 0013, "Estornos"). */
export const DESCRIPTION_MAX = 200;
export const NOTES_MAX = 1000;

export const REFUND_FORM_MESSAGES = {
    description: 'Informe a descrição.',
    descriptionMax: `Use no máximo ${DESCRIPTION_MAX} caracteres.`,
    occurredOn: 'Informe a data do estorno.',
    notesMax: `Use no máximo ${NOTES_MAX} caracteres.`,
} as const;

const description = z
    .string()
    .trim()
    .min(1, REFUND_FORM_MESSAGES.description)
    .max(DESCRIPTION_MAX, REFUND_FORM_MESSAGES.descriptionMax);
const notes = z.string().trim().max(NOTES_MAX, REFUND_FORM_MESSAGES.notesMax);

/** **Novo estorno**: o valor é texto, convertido em centavos pelo `moneySchema`. */
export const newRefundSchema = z.object({
    description,
    amount: moneySchema(),
    occurredOn: dateSchema(REFUND_FORM_MESSAGES.occurredOn),
    postedOn: optionalDateSchema(),
    expenseId: z.string(),
    notes,
});

export type NewRefundValues = z.input<typeof newRefundSchema>;
export type NewRefundOutput = z.output<typeof newRefundSchema>;

/** **Editar**: só a descrição e as observações. */
export const editRefundSchema = z.object({ description, notes });

export type EditRefundValues = z.input<typeof editRefundSchema>;

/** Corpo do `POST`: os opcionais vazios (lançamento, despesa, observações) não são enviados. */
export function createRefundBody(creditCardId: string, values: NewRefundOutput): CreateRefund {
    const body: CreateRefund = {
        creditCardId,
        description: values.description,
        amountCents: values.amount,
        occurredOn: values.occurredOn,
    };
    if (values.postedOn !== '') body.postedOn = values.postedOn;
    if (values.expenseId !== '') body.expenseId = values.expenseId;
    if (values.notes !== '') body.notes = values.notes;
    return body;
}

/** Corpo do `PATCH`: só o que mudou; observações apagadas viram `null`. */
export function changedRefundFields(
    refund: StatementRefund,
    values: EditRefundValues,
): UpdateRefund {
    const body: UpdateRefund = {};
    const nextDescription = values.description.trim();
    if (nextDescription !== refund.description) body.description = nextDescription;
    const nextNotes = values.notes.trim() === '' ? null : values.notes.trim();
    if (nextNotes !== refund.notes) body.notes = nextNotes;
    return body;
}
