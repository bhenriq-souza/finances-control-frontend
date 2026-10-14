import { describe, expect, it } from 'vitest';

import {
    balanceWindow,
    cashFlowBalances,
    cashFlowRows,
    filterRows,
    overdueBefore,
    rowAmount,
    statementWindow,
    summarizeRows,
    type BalanceReport,
} from './cash-flow-model';
import {
    ACCOUNT_ID,
    card,
    OTHER_ACCOUNT_ID,
    TRANSFER_IN_LATE,
    TRANSFER_OUT,
    TRANSFER_OUT_LATER,
    transfer,
    earning,
    expense,
    CARD_EXPENSE,
    CLOSED_TO_PAY,
    FREELA,
    INTERNET,
    LATE_EARNING,
    PAID_SEPTEMBER,
    PHARMACY,
    point,
    PROJECTED,
    RENT,
    SALARY,
    SEPTEMBER_OVERDUE,
    statement,
} from './test-data';

const VISA = card();
const TODAY_DATE = '2026-10-15';

const OCTOBER = cashFlowRows({
    month: '2026-10',
    earnings: [FREELA, SALARY, LATE_EARNING],
    expenses: [INTERNET, CARD_EXPENSE, RENT, PHARMACY, SEPTEMBER_OVERDUE],
    statements: [{ card: VISA, statements: [PAID_SEPTEMBER, CLOSED_TO_PAY, PROJECTED] }],
    today: TODAY_DATE,
});

const describeRow = (row: (typeof OCTOBER)[number]) =>
    row.kind === 'earning'
        ? row.earning.description
        : row.kind === 'expense'
          ? row.expense.description
          : row.kind === 'transfer'
            ? row.transfer.description
            : `Fatura ${row.statement.dueOn}`;

// AC-0015-14, INV-0015-07.
describe('cashFlowRows', () => {
    it('lists the month earnings, account expenses and statements due in the month, by date', () => {
        expect(OCTOBER.map(describeRow)).toEqual([
            'Salário',
            'Aluguel',
            'Fatura 2026-10-05',
            'Reembolso',
            'Farmácia',
            'Internet',
            'Freela',
        ]);
        // Despesa de cartão, vencida de setembro e faturas de outro mês ficam de fora.
        expect(OCTOBER.map(describeRow)).not.toContain('Mercado no cartão');
        expect(OCTOBER.map(describeRow)).not.toContain('IPVA');
    });

    it('lists the projected statement in its due month and never a rolled-over one', () => {
        const rows = cashFlowRows({
            today: TODAY_DATE,
            month: '2026-11',
            earnings: [],
            expenses: [],
            statements: [
                {
                    card: VISA,
                    statements: [
                        PROJECTED,
                        statement({
                            id: 's9',
                            status: 'ROLLED_OVER',
                            closesOn: '2026-10-25',
                            dueOn: '2026-11-05',
                        }),
                    ],
                },
            ],
        });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ kind: 'statement', situation: 'a-vencer' });
        expect(rows[0]?.key).toBe(`fatura:${VISA.id}:2026-10-25`);
    });

    it('signs earnings with + and expenses and statements with − (amountDueCents)', () => {
        const amounts = OCTOBER.map(rowAmount);
        expect(amounts).toEqual([500000, -180000, -102550, 10000, -4570, -9990, 80000]);
    });
});

// AC-0015-18, INV-0015-08: com uma conta escolhida, só o que é dela, transferências inclusive.
describe('cashFlowRows with an account', () => {
    const OTHER_CARD = card({ id: 'c2', name: 'Outro', paymentBankAccountId: OTHER_ACCOUNT_ID });
    const NO_PAYER = card({ id: 'c3', name: 'Sem conta', paymentBankAccountId: null });
    const otherStatement = { ...CLOSED_TO_PAY, id: 's7', creditCardId: 'c2' };
    const noPayerStatement = { ...CLOSED_TO_PAY, id: 's8', creditCardId: 'c3' };
    const input = {
        month: '2026-10',
        today: TODAY_DATE,
        earnings: [
            SALARY,
            earning({
                id: 'e9',
                description: 'De outra conta',
                status: 'RECEIVED',
                amountCents: 1,
                occurredOn: '2026-10-02',
                bankAccountId: OTHER_ACCOUNT_ID,
            }),
        ],
        expenses: [
            RENT,
            CARD_EXPENSE,
            expense({
                id: 'x9',
                description: 'De outra conta',
                status: 'PAID',
                amountCents: 1,
                occurredOn: '2026-10-02',
                bankAccountId: OTHER_ACCOUNT_ID,
            }),
        ],
        statements: [
            { card: VISA, statements: [CLOSED_TO_PAY] },
            { card: card({ id: 'c4', name: 'Também paga' }), statements: [CLOSED_TO_PAY] },
            { card: OTHER_CARD, statements: [otherStatement] },
            { card: NO_PAYER, statements: [noPayerStatement] },
        ],
        transfers: [
            TRANSFER_OUT_LATER,
            TRANSFER_IN_LATE,
            TRANSFER_OUT,
            transfer({
                id: 't9',
                description: 'De setembro',
                status: 'COMPLETED',
                amountCents: 1,
                occurredOn: '2026-09-30',
            }),
        ],
    } as const;

    const describeAny = (row: ReturnType<typeof cashFlowRows>[number]) =>
        row.kind === 'transfer'
            ? `${row.transfer.description} ${row.direction}`
            : row.kind === 'statement'
              ? `Fatura ${row.card.name}`
              : describeRow(row);

    it('keeps the account entries, the statements of the cards it pays and its transfers', () => {
        const rows = cashFlowRows({ ...input, account: ACCOUNT_ID });
        expect(rows.map(describeAny)).toEqual([
            'Reserva out',
            'Salário',
            'Aluguel',
            'Fatura Itaú Visa',
            'Fatura Também paga',
            'Resgate in',
            'Aporte out',
        ]);
        expect(rows.map(rowAmount)).toEqual([
            -20000, 500000, -180000, -102550, -102550, 15000, -5000,
        ]);
        expect(rows.filter((row) => row.kind === 'transfer').map((row) => row.situation)).toEqual([
            'realizados',
            'vencidos',
            'a-vencer',
        ]);
        expect(filterRows(rows, 'vencidos').map(describeAny)).toEqual(['Resgate in']);
    });

    it('sums incoming transfers into inflows and outgoing ones into outflows', () => {
        expect(summarizeRows(cashFlowRows({ ...input, account: ACCOUNT_ID }))).toEqual({
            inflows: { totalCents: 515000, realized: 1, pending: 1 },
            outflows: { totalCents: 410100, realized: 2, pending: 3 },
        });
    });

    it('shows the other account side of a transfer with the opposite sign', () => {
        const rows = cashFlowRows({ ...input, account: OTHER_ACCOUNT_ID });
        expect(rows.map(describeAny)).toEqual([
            'De outra conta',
            'De outra conta',
            'Reserva in',
            'Fatura Outro',
            'Resgate out',
            'Aporte in',
        ]);
    });

    it('lists no transfer and every statement for all the accounts', () => {
        const rows = cashFlowRows(input);
        expect(rows.some((row) => row.kind === 'transfer')).toBe(false);
        expect(rows.filter((row) => row.kind === 'statement')).toHaveLength(4);
    });
});

// AC-0015-14: o filtro de situação.
describe('filterRows', () => {
    it('keeps every row without a filter', () => {
        expect(filterRows(OCTOBER, undefined)).toHaveLength(OCTOBER.length);
    });

    it('splits realized, due and overdue rows', () => {
        expect(filterRows(OCTOBER, 'realizados').map(describeRow)).toEqual(['Salário', 'Aluguel']);
        expect(filterRows(OCTOBER, 'a-vencer').map(describeRow)).toEqual([
            'Fatura 2026-10-05',
            'Internet',
            'Freela',
        ]);
        expect(filterRows(OCTOBER, 'vencidos').map(describeRow)).toEqual(['Reembolso', 'Farmácia']);
    });

    it('treats a paid statement as realized and an overdue closed one as overdue', () => {
        const rows = cashFlowRows({
            today: TODAY_DATE,
            month: '2026-10',
            earnings: [],
            expenses: [
                { ...INTERNET, status: 'FORECAST' },
                { ...RENT, status: 'VERIFYING' },
            ],
            statements: [
                {
                    card: VISA,
                    statements: [
                        { ...CLOSED_TO_PAY, overdue: true },
                        statement({
                            id: 's2',
                            status: 'PAID',
                            closesOn: '2026-09-28',
                            dueOn: '2026-10-08',
                        }),
                    ],
                },
            ],
        });
        expect(rows.map((row) => row.situation)).toEqual([
            'a-vencer',
            'vencidos',
            'realizados',
            'a-vencer',
        ]);
    });
});

// AC-0015-15: entradas e saídas são as somas da lista.
describe('summarizeRows', () => {
    it('sums the earnings into inflows and the expenses and statements into outflows', () => {
        expect(summarizeRows(OCTOBER)).toEqual({
            inflows: { totalCents: 590000, realized: 1, pending: 2 },
            outflows: { totalCents: 297110, realized: 1, pending: 3 },
        });
    });
});

const report = (points: BalanceReport['points']): BalanceReport => ({
    from: points[0]?.month ?? '',
    to: points.at(-1)?.month ?? '',
    points,
});

// AC-0015-15: os saldos, só somas e subtrações de números da API (INV-0015-02).
describe('cashFlowBalances', () => {
    it('asks the balance from min(month, current) − 1 to the month', () => {
        expect(balanceWindow('2026-10', '2026-10')).toEqual({ from: '2026-09', to: '2026-10' });
        expect(balanceWindow('2026-12', '2026-10')).toEqual({ from: '2026-09', to: '2026-12' });
        expect(balanceWindow('2026-08', '2026-10')).toEqual({ from: '2026-07', to: '2026-08' });
    });

    it('uses the realized points in a past month', () => {
        const balances = cashFlowBalances(
            report([point('2026-07', 'REALIZED', 100000), point('2026-08', 'REALIZED', 120000)]),
            '2026-08',
            '2026-10',
        );
        expect(balances).toEqual({
            start: { cents: 100000, kind: 'REALIZED' },
            end: { cents: 120000, kind: 'REALIZED' },
        });
    });

    it('takes the month card dues off the forecast in the current month', () => {
        const balances = cashFlowBalances(
            report([
                point('2026-09', 'REALIZED', 487655),
                point('2026-10', 'FORECAST', 612345, 37550),
            ]),
            '2026-10',
            '2026-10',
        );
        expect(balances).toEqual({
            start: { cents: 487655, kind: 'REALIZED' },
            end: { cents: 574795, kind: 'FORECAST' },
        });
    });

    it('takes every card due since the current month off a later month', () => {
        const balances = cashFlowBalances(
            report([
                point('2026-09', 'REALIZED', 487655),
                point('2026-10', 'FORECAST', 612345, 37550),
                point('2026-11', 'FORECAST', 700000, 30000),
                point('2026-12', 'FORECAST', 800000, null),
            ]),
            '2026-12',
            '2026-10',
        );
        // Fim de novembro: 700000 − 37550 − 30000; fim de dezembro: 800000 − 67550.
        expect(balances).toEqual({
            start: { cents: 632450, kind: 'FORECAST' },
            end: { cents: 732450, kind: 'FORECAST' },
        });
    });

    it('is null when a point is missing', () => {
        expect(
            cashFlowBalances(report([point('2026-10', 'FORECAST', 1)]), '2026-10', '2026-10'),
        ).toBeNull();
        expect(
            cashFlowBalances(
                report([point('2026-09', 'REALIZED', 1), point('2026-11', 'FORECAST', 1)]),
                '2026-11',
                '2026-10',
            ),
        ).toBeNull();
    });
});

describe('statementWindow', () => {
    it('goes from the first day of month − 2 to the last day of the month', () => {
        expect(statementWindow('2026-10')).toEqual({ from: '2026-08-01', to: '2026-10-31' });
        expect(statementWindow('2026-01')).toEqual({ from: '2025-11-01', to: '2026-01-31' });
    });
});

// AC-0015-15: as vencidas de meses anteriores.
describe('overdueBefore', () => {
    it('counts overdue account expenses and earnings dated before the month', () => {
        const septemberEarning = { ...LATE_EARNING, occurredOn: '2026-09-30' };
        const cardOverdue = {
            ...CARD_EXPENSE,
            status: 'OVERDUE' as const,
            occurredOn: '2026-09-01',
        };
        expect(
            overdueBefore(
                '2026-10',
                [SEPTEMBER_OVERDUE, PHARMACY, cardOverdue],
                [septemberEarning, LATE_EARNING],
            ),
        ).toEqual({ expenses: 1, earnings: 1, transfers: 0 });
        expect(
            overdueBefore(
                '2026-10',
                [],
                [],
                [
                    { ...TRANSFER_IN_LATE, occurredOn: '2026-09-30' },
                    { ...TRANSFER_OUT, occurredOn: '2026-09-01' },
                    TRANSFER_OUT_LATER,
                ],
            ),
        ).toEqual({ expenses: 0, earnings: 0, transfers: 1 });
        expect(overdueBefore('2026-09', [SEPTEMBER_OVERDUE], [])).toEqual({
            expenses: 0,
            earnings: 0,
            transfers: 0,
        });
    });
});
