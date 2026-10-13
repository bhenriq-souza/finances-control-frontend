import { z } from 'zod';

import { type Cents, moneySchema } from '@/shared/money';

import { EXPENSE_KINDS } from './list/expense-model';

// Schemas do formulário de despesa (spec 0012, "Formulário de despesa"). O formulário guarda tudo
// como texto; o valor vira centavos pelo `moneySchema` (INV-0012-01).

export const INSTALLMENTS_MIN = 2;
export const INSTALLMENTS_MAX = 120;

/** Situação inicial de uma despesa nova: só as que o `POST /expenses` aceita. */
export const INITIAL_STATUSES = ['OPEN', 'FORECAST', 'VERIFYING'] as const;

/** Onde vale a alteração de uma ocorrência de série: só ela ou ela e as próximas previstas. */
export const EDIT_SCOPES = ['single', 'following'] as const;

export const EXPENSE_FORM_MESSAGES = {
    description: 'Informe a descrição.',
    expenseType: 'Escolha o tipo.',
    payment: 'Escolha a conta ou o cartão.',
    occurredOn: 'Informe a data.',
    installments: `Informe de ${INSTALLMENTS_MIN} a ${INSTALLMENTS_MAX} parcelas.`,
    postedOn: 'A fatura não pode ser anterior à data da compra.',
    recurrenceEndsOn: 'A data final não pode ser anterior à primeira data.',
} as const;

// "Pagar com" é um `<select>` só, com os grupos Contas e Cartões: o valor diz qual dos dois é.
const ACCOUNT_PREFIX = 'conta:';
const CARD_PREFIX = 'cartao:';

export type PaymentMethod = { bankAccountId: string } | { creditCardId: string };

export const accountPayment = (id: string) => `${ACCOUNT_PREFIX}${id}`;
export const cardPayment = (id: string) => `${CARD_PREFIX}${id}`;

/** O valor de "Pagar com" como exatamente um de `bankAccountId`/`creditCardId`; vazio, nenhum. */
export function parsePayment(value: string): PaymentMethod | null {
    if (value.startsWith(ACCOUNT_PREFIX) && value.length > ACCOUNT_PREFIX.length) {
        return { bankAccountId: value.slice(ACCOUNT_PREFIX.length) };
    }
    if (value.startsWith(CARD_PREFIX) && value.length > CARD_PREFIX.length) {
        return { creditCardId: value.slice(CARD_PREFIX.length) };
    }
    return null;
}

export const isCardPayment = (value: string) => {
    const payment = parsePayment(value);
    return payment !== null && 'creditCardId' in payment;
};

const required = (message: string) => z.string().trim().min(1, message);

/** Uma data opcional (vazia = ausente) não pode ser anterior a outra. */
const notBefore = (date: string, reference: string) =>
    date === '' || reference === '' || date >= reference;

/** Criar: variável, parcelada ou fixa, numa conta ou num cartão. */
export const expenseCreateSchema = z
    .object({
        kind: z.enum(EXPENSE_KINDS),
        description: required(EXPENSE_FORM_MESSAGES.description),
        expenseTypeId: required(EXPENSE_FORM_MESSAGES.expenseType),
        amount: moneySchema(),
        payment: z
            .string()
            .refine((value) => parsePayment(value) !== null, EXPENSE_FORM_MESSAGES.payment),
        occurredOn: required(EXPENSE_FORM_MESSAGES.occurredOn),
        postedOn: z.string(),
        installmentTotal: z.string(),
        recurrenceEndsOn: z.string(),
        status: z.enum(INITIAL_STATUSES),
        notes: z.string(),
    })
    .superRefine((values, ctx) => {
        if (values.kind === 'INSTALLMENT') {
            const text = values.installmentTotal.trim();
            const total = Number(text);
            if (!/^\d+$/.test(text) || total < INSTALLMENTS_MIN || total > INSTALLMENTS_MAX) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['installmentTotal'],
                    message: EXPENSE_FORM_MESSAGES.installments,
                });
            }
        }
        if (isCardPayment(values.payment) && !notBefore(values.postedOn, values.occurredOn)) {
            ctx.addIssue({
                code: 'custom',
                path: ['postedOn'],
                message: EXPENSE_FORM_MESSAGES.postedOn,
            });
        }
        if (values.kind === 'FIXED' && !notBefore(values.recurrenceEndsOn, values.occurredOn)) {
            ctx.addIssue({
                code: 'custom',
                path: ['recurrenceEndsOn'],
                message: EXPENSE_FORM_MESSAGES.recurrenceEndsOn,
            });
        }
    });

export type ExpenseCreateValues = z.input<typeof expenseCreateSchema>;
export type ExpenseCreateOutput = z.output<typeof expenseCreateSchema>;

/**
 * Alterar: natureza, forma de pagamento, parcelas, série e situação não existem aqui
 * (INV-0012-05). O valor só muda em despesa não paga (`amountEditable`); na paga, `amount` sai
 * `null`. `postedOn` só é validado em despesa de cartão.
 */
export function expenseEditSchema({
    amountEditable,
    card,
}: {
    amountEditable: boolean;
    card: boolean;
}) {
    const amount: z.ZodType<Cents | null, string> = amountEditable
        ? moneySchema()
        : z.string().transform((): Cents | null => null);
    return z
        .object({
            description: required(EXPENSE_FORM_MESSAGES.description),
            expenseTypeId: required(EXPENSE_FORM_MESSAGES.expenseType),
            amount,
            occurredOn: required(EXPENSE_FORM_MESSAGES.occurredOn),
            postedOn: z.string(),
            notes: z.string(),
            scope: z.enum(EDIT_SCOPES),
        })
        .refine((values) => !card || notBefore(values.postedOn, values.occurredOn), {
            path: ['postedOn'],
            message: EXPENSE_FORM_MESSAGES.postedOn,
        });
}

export type ExpenseEditValues = z.input<ReturnType<typeof expenseEditSchema>>;
export type ExpenseEditOutput = z.output<ReturnType<typeof expenseEditSchema>>;
