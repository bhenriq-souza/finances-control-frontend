import { z } from 'zod';

import { isIsoDate } from '@/shared/dates';
import { moneySchema } from '@/shared/money';

import { EARNING_KINDS } from '../list/earning-model';

/** Situação inicial de uma receita nova (spec 0012, "Situação inicial"). */
export const INITIAL_STATUSES = ['OPEN', 'FORECAST', 'VERIFYING'] as const;

export const INSTALLMENTS_MIN = 2;
export const INSTALLMENTS_MAX = 120;

/** Limites do contrato (spec 0014, "Formulário de receita"). */
export const DESCRIPTION_MAX = 200;
export const NOTES_MAX = 1000;

export const EARNING_FORM_MESSAGES = {
    description: 'Informe a descrição.',
    descriptionMax: `Use no máximo ${DESCRIPTION_MAX} caracteres.`,
    type: 'Escolha o tipo.',
    account: 'Escolha a conta.',
    date: 'Informe a data prevista.',
    installments: `Informe de ${INSTALLMENTS_MIN} a ${INSTALLMENTS_MAX} parcelas.`,
    recurrenceEndsOn: 'A data final não pode ser anterior à data prevista.',
    notesMax: `Use no máximo ${NOTES_MAX} caracteres.`,
} as const;

const required = (message: string) => z.string().trim().min(1, message);

const base = z.object({
    kind: z.enum(EARNING_KINDS),
    description: required(EARNING_FORM_MESSAGES.description).max(
        DESCRIPTION_MAX,
        EARNING_FORM_MESSAGES.descriptionMax,
    ),
    earningTypeId: required(EARNING_FORM_MESSAGES.type),
    amount: moneySchema(),
    bankAccountId: required(EARNING_FORM_MESSAGES.account),
    occurredOn: z.string().refine(isIsoDate, EARNING_FORM_MESSAGES.date),
    installmentTotal: z.string(),
    recurrenceEndsOn: z.string(),
    status: z.enum(INITIAL_STATUSES),
    notes: z.string().trim().max(NOTES_MAX, EARNING_FORM_MESSAGES.notesMax),
    scope: z.enum(['one', 'following']),
});

function isInstallmentTotal(text: string): boolean {
    if (!/^\d{1,3}$/.test(text.trim())) return false;
    const total = Number(text.trim());
    return total >= INSTALLMENTS_MIN && total <= INSTALLMENTS_MAX;
}

/**
 * Schema do formulário de receita. Ao criar, as parcelas valem só em Parcelada e **Repetir até**
 * só em Fixa; ao alterar, natureza, situação, parcelas e série não são editáveis e não são
 * validadas.
 */
export function earningFormSchema(mode: 'create' | 'edit') {
    return base.superRefine((values, ctx) => {
        if (mode === 'edit') return;
        if (values.kind === 'INSTALLMENT' && !isInstallmentTotal(values.installmentTotal)) {
            ctx.addIssue({
                code: 'custom',
                message: EARNING_FORM_MESSAGES.installments,
                path: ['installmentTotal'],
            });
        }
        if (
            values.kind === 'FIXED' &&
            values.recurrenceEndsOn !== '' &&
            (!isIsoDate(values.recurrenceEndsOn) || values.recurrenceEndsOn < values.occurredOn)
        ) {
            ctx.addIssue({
                code: 'custom',
                message: EARNING_FORM_MESSAGES.recurrenceEndsOn,
                path: ['recurrenceEndsOn'],
            });
        }
    });
}

/** O que o formulário guarda: tudo texto; o schema converte o valor em centavos. */
export type EarningFormValues = z.input<typeof base>;
export type EarningFormOutput = z.output<typeof base>;
