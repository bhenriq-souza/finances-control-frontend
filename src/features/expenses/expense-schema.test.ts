import { describe, expect, it } from 'vitest';

import { INVALID_DATE_MESSAGE } from '@/shared/dates';

import { paymentMethodSchema } from './detail/actions/action-schemas';
import { expenseCreateSchema, type ExpenseCreateValues } from './expense-schema';

const VALID: ExpenseCreateValues = {
    kind: 'VARIABLE',
    description: 'Mercado',
    expenseTypeId: 't1',
    amount: '10,00',
    payment: 'conta:a1',
    occurredOn: '2026-10-05',
    postedOn: '',
    installmentTotal: '',
    recurrenceEndsOn: '',
    status: 'OPEN',
    notes: '',
};

const issuesAt = (
    result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } },
    path: string,
) =>
    (result.error?.issues ?? [])
        .filter((issue) => issue.path[0] === path)
        .map((issue) => issue.message);

// Um texto inválido deixado num campo que sumiu do formulário não trava o envio (spec 0009, DateField).
describe('hidden optional dates', () => {
    it('ignores an invalid Fatura de once the payment is an account, and refuses it with a card', () => {
        const hidden = expenseCreateSchema.safeParse({ ...VALID, postedOn: '05/11' });
        expect(hidden.success).toBe(true);

        const shown = expenseCreateSchema.safeParse({
            ...VALID,
            payment: 'cartao:c1',
            postedOn: '05/11',
        });
        expect(issuesAt(shown, 'postedOn')).toContain(INVALID_DATE_MESSAGE);
    });

    it('ignores an invalid Repetir até outside Fixa, and refuses it in Fixa', () => {
        expect(
            expenseCreateSchema.safeParse({ ...VALID, recurrenceEndsOn: '31/02/2026' }).success,
        ).toBe(true);

        const shown = expenseCreateSchema.safeParse({
            ...VALID,
            kind: 'FIXED',
            recurrenceEndsOn: '31/02/2026',
        });
        expect(issuesAt(shown, 'recurrenceEndsOn')).toContain(INVALID_DATE_MESSAGE);
    });

    it('Trocar forma de pagamento ignores an invalid Fatura de for an account and refuses it for a card', () => {
        const schema = paymentMethodSchema('2026-10-05');
        expect(
            schema.safeParse({ method: 'conta:a2', postedOn: '05/1', scope: 'single' }).success,
        ).toBe(true);

        const shown = schema.safeParse({ method: 'cartao:c1', postedOn: '05/1', scope: 'single' });
        expect(issuesAt(shown, 'postedOn')).toContain(INVALID_DATE_MESSAGE);
    });
});
