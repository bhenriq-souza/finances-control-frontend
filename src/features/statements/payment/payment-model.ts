import { z } from 'zod';

import { addDays, dateSchema, type IsoDate } from '@/shared/dates';
import { moneySchema } from '@/shared/money';

import type { Statement, StatementPayment } from '../panel/statement-model';

// Regras de tela do pagamento, do desfazer e do mínimo (spec 0013, "Pagar", "Desfazer
// pagamento", "Mínimo"). Nenhum valor da fatura é calculado aqui, exceto o "Mínimo" do pagamento
// (`minimumPaymentCents − paidCents`, INV-0013-01).

/** A fatura aberta (projetada, sem `id`) paga e desfaz pelas rotas de `/statements/current`. */
export function isOpenStatement(statement: Statement): boolean {
    return statement.status === 'OPEN' || statement.id === null;
}

/** **Pagar fatura**: há restante e a fatura não está paga nem rolada. */
export function canPay(statement: Statement): boolean {
    return (
        statement.remainingCents > 0 &&
        statement.status !== 'PAID' &&
        statement.status !== 'ROLLED_OVER'
    );
}

/**
 * O "Mínimo" do pagamento: `minimumPaymentCents − paidCents`, só com o mínimo informado e maior
 * que o já pago (AC-0013-04); senão, `null` e a opção não aparece.
 */
export function minimumDueCents(statement: Statement): number | null {
    const minimum = statement.minimumPaymentCents;
    return minimum !== null && minimum > statement.paidCents ? minimum - statement.paidCents : null;
}

/**
 * O último pagamento da fatura, o único que pode ser desfeito (INV-0013-02): o de `createdAt`
 * mais recente; no empate, o que vem depois na resposta.
 */
export function lastPayment(payments: readonly StatementPayment[]): StatementPayment | undefined {
    let last: StatementPayment | undefined;
    for (const payment of payments) {
        if (!last || payment.createdAt >= last.createdAt) last = payment;
    }
    return last;
}

/** A janela de `paidOn`: na aberta, de `startsOn` até hoje; na fechada, depois de `closesOn`. */
export function paidOnWindow(statement: Statement, today: IsoDate): { min: IsoDate; max: IsoDate } {
    return {
        min: isOpenStatement(statement) ? statement.startsOn : addDays(statement.closesOn, 1),
        max: today,
    };
}

/**
 * A fatura fechada mais antiga com restante, achada na lista já carregada para o alerta de
 * `STATEMENT_PREVIOUS_UNPAID` — nunca pelo texto da mensagem do backend (INV-0013-04).
 */
export function pendingStatement(
    statements: readonly Statement[] | undefined,
): (Statement & { id: string }) | undefined {
    return (statements ?? [])
        .filter(
            (statement): statement is Statement & { id: string } =>
                statement.id !== null &&
                statement.status === 'CLOSED' &&
                statement.remainingCents > 0,
        )
        .sort((a, b) => a.closesOn.localeCompare(b.closesOn))[0];
}

export type AmountChoice = 'total' | 'minimo' | 'outro';

export const PAYMENT_MESSAGES = {
    conta: 'Escolha a conta.',
    data: 'Informe a data do pagamento.',
    janelaAberta: 'Use uma data entre o início da fatura e hoje.',
    janelaFechada: 'Use uma data depois do fechamento da fatura e até hoje.',
    acimaDoRestante: 'O valor passa do restante da fatura.',
} as const;

/** O que o formulário guarda: tudo texto; o schema resolve o valor em centavos. */
export interface PaymentValues {
    choice: AmountChoice;
    other: string;
    bankAccountId: string;
    paidOn: string;
}

export interface PaymentOutput {
    amountCents: number;
    bankAccountId: string;
    paidOn: IsoDate;
}

/**
 * O schema do pagamento de uma fatura: **Total restante** (`remainingCents`), **Mínimo**
 * (`minimumDueCents`) ou **Outro valor** (`moneySchema()`, até `remainingCents`); conta
 * obrigatória; `paidOn` na janela da fatura.
 */
export function paymentSchema(statement: Statement, today: IsoDate) {
    const window = paidOnWindow(statement, today);
    const outsideWindow = isOpenStatement(statement)
        ? PAYMENT_MESSAGES.janelaAberta
        : PAYMENT_MESSAGES.janelaFechada;
    const minimum = minimumDueCents(statement);
    const other = moneySchema();

    return z
        .object({
            choice: z.enum(['total', 'minimo', 'outro']),
            other: z.string(),
            bankAccountId: z.string().min(1, PAYMENT_MESSAGES.conta),
            paidOn: dateSchema(PAYMENT_MESSAGES.data).refine(
                (date) => date >= window.min && date <= window.max,
                outsideWindow,
            ),
        })
        .transform((values, ctx): PaymentOutput => {
            let amountCents: number = statement.remainingCents;
            if (values.choice === 'minimo' && minimum !== null) amountCents = minimum;
            if (values.choice === 'outro') {
                const parsed = other.safeParse(values.other);
                if (!parsed.success) {
                    for (const issue of parsed.error.issues) {
                        ctx.issues.push({
                            code: 'custom',
                            message: issue.message,
                            path: ['other'],
                            input: values.other,
                        });
                    }
                    return z.NEVER;
                }
                if (parsed.data > statement.remainingCents) {
                    ctx.issues.push({
                        code: 'custom',
                        message: PAYMENT_MESSAGES.acimaDoRestante,
                        path: ['other'],
                        input: values.other,
                    });
                    return z.NEVER;
                }
                amountCents = parsed.data;
            }
            return {
                amountCents,
                bankAccountId: values.bankAccountId,
                paidOn: values.paidOn,
            };
        });
}

/** O mínimo informado: `moneySchema({ min: 'nonnegative' })` (zero vale). */
export const minimumSchema = z.object({ minimum: moneySchema({ min: 'nonnegative' }) });

export type MinimumValues = z.input<typeof minimumSchema>;
export type MinimumOutput = z.output<typeof minimumSchema>;
