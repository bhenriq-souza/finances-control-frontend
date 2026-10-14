import { describe, expect, it } from 'vitest';

import { CARD_ID, CURRENT, EXPENSE_ID } from '../panel/test-data';

import { changedRefundFields, createRefundBody, newRefundSchema } from './refund-schema';

const REFUND = CURRENT.refunds![0]!;

describe('refund form (spec 0013)', () => {
    it('converts the amount to cents and leaves the empty optionals out of the POST', () => {
        const values = newRefundSchema.parse({
            description: ' Devolução ',
            amount: '1.234,56',
            occurredOn: '2026-10-20',
            postedOn: '',
            expenseId: '',
            notes: '',
        });
        expect(createRefundBody(CARD_ID, values)).toEqual({
            creditCardId: CARD_ID,
            description: 'Devolução',
            amountCents: 123456,
            occurredOn: '2026-10-20',
        });
    });

    it('sends postedOn, expenseId and notes when filled', () => {
        const values = newRefundSchema.parse({
            description: 'Devolução',
            amount: '10',
            occurredOn: '2026-10-20',
            postedOn: '2026-10-21',
            expenseId: EXPENSE_ID,
            notes: 'Loja',
        });
        expect(createRefundBody(CARD_ID, values)).toMatchObject({
            amountCents: 1000,
            postedOn: '2026-10-21',
            expenseId: EXPENSE_ID,
            notes: 'Loja',
        });
    });

    it('rejects a zero amount, an empty description and an invalid posting date', () => {
        const result = newRefundSchema.safeParse({
            description: ' ',
            amount: '0',
            occurredOn: '2026-10-20',
            postedOn: '20/10',
            expenseId: '',
            notes: '',
        });
        expect(result.success).toBe(false);
        const paths = result.error!.issues.map((issue) => issue.path[0]);
        expect(paths).toEqual(expect.arrayContaining(['description', 'amount', 'postedOn']));
    });

    it('patches only what changed, with cleared notes as null', () => {
        expect(changedRefundFields(REFUND, { description: REFUND.description, notes: '' })).toEqual(
            {},
        );
        expect(changedRefundFields(REFUND, { description: 'Nova', notes: ' Obs ' })).toEqual({
            description: 'Nova',
            notes: 'Obs',
        });
        expect(
            changedRefundFields(
                { ...REFUND, notes: 'Antiga' },
                { description: REFUND.description, notes: '' },
            ),
        ).toEqual({ notes: null });
    });
});
