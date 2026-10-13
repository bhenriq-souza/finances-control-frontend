import { describe, expect, it } from 'vitest';

import type { BankAccount, CreditCard } from '@/api/queries/reference';

import { ACCOUNT_ID, ACCOUNTS, CARD_ID, CARDS, GROUP_ID } from '../../list/expense-test-data';
import type { ExpenseStatus } from '../../list/expense-model';

import { paymentMethodSchema } from './action-schemas';
import {
    deleteCascadeText,
    expenseActions,
    parsePaymentMethod,
    paymentMethodOptions,
} from './expense-action-model';
import { paymentMethodBody } from './payment-method-dialog';

const accounts = ACCOUNTS as unknown as BankAccount[];
const cards = CARDS as unknown as CreditCard[];

describe('expenseActions (INV-0012-02, INV-0012-03)', () => {
    const table: [ExpenseStatus, string[], string[]][] = [
        ['FORECAST', ['confirm'], ['confirm']],
        ['OPEN', ['pay', 'verify'], ['verify']],
        ['OVERDUE', ['pay', 'verify'], ['verify']],
        ['VERIFYING', ['pay', 'reopen'], ['reopen']],
        ['PAID', ['undo-payment'], []],
    ];

    it.each(table)('%s: account %j, card %j', (status, account, card) => {
        const forAccount = expenseActions({ status, creditCardId: null });
        const forCard = expenseActions({ status, creditCardId: CARD_ID });
        expect(forAccount.status).toEqual(account);
        expect(forCard.status).toEqual(card);
        expect(forCard.status).not.toContain('pay');
        expect(forCard.status).not.toContain('undo-payment');
        const unpaid = status !== 'PAID';
        for (const actions of [forAccount, forCard]) {
            expect(actions.remove).toBe(unpaid);
            expect(actions.changeMethod).toBe(unpaid);
        }
    });
});

describe('deleteCascadeText (INV-0012-04)', () => {
    it('describes the cascade of a single expense, an installment and a series', () => {
        expect(deleteCascadeText({ installment: null, recurrenceId: null })).toBe(
            'A despesa será excluída.',
        );
        expect(
            deleteCascadeText({
                installment: { groupId: GROUP_ID, number: 1, total: 3 },
                recurrenceId: null,
            }),
        ).toBe('Todas as parcelas não pagas deste parcelamento serão excluídas.');
        expect(deleteCascadeText({ installment: null, recurrenceId: 'serie' })).toBe(
            'Esta ocorrência e as seguintes ainda não pagas serão excluídas, e a série termina.',
        );
    });
});

describe('payment method', () => {
    it('parses the select value', () => {
        expect(parsePaymentMethod(`conta:${ACCOUNT_ID}`)).toEqual({
            kind: 'conta',
            id: ACCOUNT_ID,
        });
        expect(parsePaymentMethod(`cartao:${CARD_ID}`)).toEqual({ kind: 'cartao', id: CARD_ID });
        expect(parsePaymentMethod('')).toBeNull();
        expect(parsePaymentMethod('banco:x')).toBeNull();
        expect(parsePaymentMethod('conta:')).toBeNull();
    });

    it('offers the active accounts and cards except the current one', () => {
        expect(
            paymentMethodOptions({ bankAccountId: null, creditCardId: CARD_ID }, accounts, cards),
        ).toEqual([
            {
                label: 'Contas',
                options: [{ value: `conta:${ACCOUNT_ID}`, label: 'Conta corrente' }],
            },
        ]);
        expect(
            paymentMethodOptions(
                { bankAccountId: ACCOUNT_ID, creditCardId: null },
                accounts,
                cards,
            ),
        ).toEqual([
            { label: 'Cartões', options: [{ value: `cartao:${CARD_ID}`, label: 'Nubank' }] },
        ]);
    });

    it('sends exactly one of bankAccountId and creditCardId', () => {
        expect(paymentMethodBody({ kind: 'conta', id: ACCOUNT_ID }, '2026-11-04')).toEqual({
            bankAccountId: ACCOUNT_ID,
        });
        expect(paymentMethodBody({ kind: 'cartao', id: CARD_ID }, '')).toEqual({
            creditCardId: CARD_ID,
        });
        expect(paymentMethodBody({ kind: 'cartao', id: CARD_ID }, '2026-11-04')).toEqual({
            creditCardId: CARD_ID,
            postedOn: '2026-11-04',
        });
    });

    it('validates the destination and a statement not before the purchase', () => {
        const schema = paymentMethodSchema('2026-10-15');
        const base = { postedOn: '', scope: 'single' as const };
        expect(schema.safeParse({ ...base, method: '' }).success).toBe(false);
        expect(schema.safeParse({ ...base, method: `cartao:${CARD_ID}` }).success).toBe(true);
        expect(
            schema.safeParse({ ...base, method: `cartao:${CARD_ID}`, postedOn: '2026-10-14' })
                .success,
        ).toBe(false);
        expect(
            schema.safeParse({ ...base, method: `cartao:${CARD_ID}`, postedOn: '2026-10-15' })
                .success,
        ).toBe(true);
        // Com conta, a fatura não vale.
        expect(
            schema.safeParse({ ...base, method: `conta:${ACCOUNT_ID}`, postedOn: '2026-10-01' })
                .success,
        ).toBe(true);
    });
});
