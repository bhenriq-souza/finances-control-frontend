import { describe, expect, it } from 'vitest';

import { CLOSED, CURRENT, OLDER, statementFixture } from '../panel/test-data';

import {
    canPay,
    lastPayment,
    minimumDueCents,
    paidOnWindow,
    PAYMENT_MESSAGES,
    paymentSchema,
    pendingStatement,
} from './payment-model';

const TODAY = '2026-10-20';

function payment(id: string, createdAt: string) {
    return { id, bankAccountId: 'a', amountCents: 100, paidOn: '2026-10-15', createdAt };
}

describe('payment rules (spec 0013)', () => {
    it('offers Pagar only with remaining and when not paid nor rolled over', () => {
        expect(canPay(CURRENT)).toBe(true);
        expect(canPay(CLOSED)).toBe(true);
        expect(canPay(OLDER)).toBe(false);
        expect(canPay({ ...CLOSED, status: 'ROLLED_OVER' })).toBe(false);
        expect(canPay({ ...CLOSED, remainingCents: 0 })).toBe(false);
    });

    // AC-0013-04, INV-0013-01: o único valor calculado no cliente.
    it('computes the minimum as minimumPaymentCents − paidCents, only above what was paid', () => {
        expect(minimumDueCents(CLOSED)).toBe(7000);
        expect(minimumDueCents({ ...CLOSED, paidCents: 2000 })).toBe(5000);
        expect(minimumDueCents({ ...CLOSED, paidCents: 7000 })).toBeNull();
        expect(minimumDueCents(CURRENT)).toBeNull();
    });

    // INV-0013-02.
    it('finds the last payment by createdAt, the later one in the response on a tie', () => {
        expect(lastPayment([])).toBeUndefined();
        expect(
            lastPayment([
                payment('b', '2026-10-16T12:00:00Z'),
                payment('a', '2026-10-15T12:00:00Z'),
            ])?.id,
        ).toBe('b');
        expect(
            lastPayment([
                payment('a', '2026-10-15T12:00:00Z'),
                payment('b', '2026-10-15T12:00:00Z'),
            ])?.id,
        ).toBe('b');
    });

    it('limits paidOn to the statement window', () => {
        expect(paidOnWindow(CURRENT, TODAY)).toEqual({ min: '2026-10-09', max: TODAY });
        expect(paidOnWindow(CLOSED, TODAY)).toEqual({ min: '2026-10-09', max: TODAY });
    });

    // INV-0013-04: a fatura pendente vem da lista, nunca da mensagem.
    it('finds the oldest closed statement with remaining in the loaded list', () => {
        const older = statementFixture({
            ...CLOSED,
            id: 'older',
            closesOn: '2026-09-08',
            remainingCents: 100,
        });
        expect(pendingStatement([CURRENT, CLOSED, older, OLDER])?.id).toBe('older');
        expect(pendingStatement([CURRENT, OLDER])).toBeUndefined();
        expect(pendingStatement(undefined)).toBeUndefined();
    });
});

describe('paymentSchema', () => {
    const base = { other: '', bankAccountId: 'a', paidOn: TODAY };

    it('resolves the total, the minimum and another amount in cents', () => {
        const schema = paymentSchema({ ...CLOSED, paidCents: 2000, remainingCents: 33000 }, TODAY);
        expect(schema.parse({ ...base, choice: 'total' }).amountCents).toBe(33000);
        expect(schema.parse({ ...base, choice: 'minimo' }).amountCents).toBe(5000);
        expect(schema.parse({ ...base, choice: 'outro', other: '123,45' }).amountCents).toBe(12345);
    });

    it('refuses another amount above the remaining, an empty account and a date out of window', () => {
        const schema = paymentSchema(CLOSED, TODAY);
        const above = schema.safeParse({ ...base, choice: 'outro', other: '350,01' });
        expect(above.error?.issues[0]).toMatchObject({
            path: ['other'],
            message: PAYMENT_MESSAGES.acimaDoRestante,
        });
        const issues = schema.safeParse({
            ...base,
            choice: 'total',
            bankAccountId: '',
            paidOn: '2026-10-08',
        }).error?.issues;
        expect(issues?.map((issue) => issue.message)).toEqual([
            PAYMENT_MESSAGES.conta,
            PAYMENT_MESSAGES.janelaFechada,
        ]);
        expect(
            paymentSchema(CURRENT, TODAY).safeParse({
                ...base,
                choice: 'total',
                paidOn: '2026-10-08',
            }).error?.issues[0]?.message,
        ).toBe(PAYMENT_MESSAGES.janelaAberta);
    });
});
