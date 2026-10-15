import { describe, expect, it } from 'vitest';

import {
    activeAccounts,
    activeCards,
    closedStatementToPay,
    countLabel,
    dueAmount,
    dueThisWeek,
    forecastBalance,
    OTHERS_LABEL,
    realizedBalance,
    summarizeEarnings,
    summarizeExpenses,
    topExpenseTypes,
    weekEnd,
} from './dashboard-data';
import {
    account,
    balancePoint,
    balanceReport,
    byTypeReport,
    card,
    earning,
    expense,
    statement,
    TODAY,
} from './test-data';

describe('balance (AC-0015-01, INV-0015-02)', () => {
    const accounts = [
        account({ id: 'a1', description: 'Poupança', currentBalanceCents: 500000 }),
        account({ id: 'a2', description: 'Conta corrente', currentBalanceCents: -12345 }),
        account({
            id: 'a3',
            description: 'Arquivada',
            currentBalanceCents: 999900,
            archivedAt: '2026-09-01T12:00:00Z',
        }),
    ];

    it('sums currentBalanceCents of the active accounts only', () => {
        expect(realizedBalance(accounts)).toBe(487655);
        expect(realizedBalance([])).toBe(0);
    });

    it('lists the active accounts and cards by name', () => {
        expect(activeAccounts(accounts).map((a) => a.id)).toEqual(['a2', 'a1']);
        const cards = [
            card({ id: 'c1', name: 'Visa' }),
            card({ id: 'c2', name: 'Antigo', archivedAt: '2026-09-01T12:00:00Z' }),
            card({ id: 'c3', name: 'Roxinho' }),
        ];
        expect(activeCards(cards).map((c) => c.id)).toEqual(['c3', 'c1']);
    });

    it('discounts the statements due in the month from the FORECAST point', () => {
        const report = balanceReport([
            balancePoint({ month: '2026-09', kind: 'REALIZED', accountsTotalCents: 1 }),
            balancePoint({
                month: '2026-10',
                kind: 'FORECAST',
                accountsTotalCents: 612345,
                cardDueCents: 37550,
            }),
            balancePoint({ month: '2026-11', kind: 'REALIZED', accountsTotalCents: 2 }),
        ]);
        // 612345 − 37550, the cash flow end of 2026-10 (AC-0015-15).
        expect(forecastBalance(report, '2026-10')).toBe(574795);
        expect(
            forecastBalance(
                balanceReport([
                    balancePoint({
                        month: '2026-10',
                        kind: 'FORECAST',
                        accountsTotalCents: 612345,
                    }),
                ]),
                '2026-10',
            ),
        ).toBe(612345);
        expect(forecastBalance(report, '2026-11')).toBeNull();
        expect(forecastBalance(report, '2026-09')).toBeNull();
    });
});

describe('month totals (AC-0015-01)', () => {
    it('sums the earnings of every status and counts received and pending', () => {
        const summary = summarizeEarnings([
            earning({ id: 'r1', status: 'RECEIVED', amountCents: 500000 }),
            earning({ id: 'r2', status: 'OVERDUE', amountCents: 150000 }),
            earning({ id: 'r3', status: 'FORECAST', amountCents: 80050 }),
        ]);
        expect(summary).toEqual({ totalCents: 730050, received: 1, pending: 2 });
    });

    it('sums the expenses of every status and counts paid, pending and overdue', () => {
        const summary = summarizeExpenses([
            expense({ id: 'e1', description: 'a', status: 'PAID', amountCents: 180000 }),
            expense({ id: 'e2', description: 'b', status: 'OVERDUE', amountCents: 4570 }),
            expense({ id: 'e3', description: 'c', status: 'FORECAST', amountCents: 15000 }),
            expense({ id: 'e4', description: 'd', status: 'VERIFYING', amountCents: 1 }),
            expense({ id: 'e5', description: 'e', status: 'OPEN', amountCents: 2 }),
        ]);
        expect(summary).toEqual({ totalCents: 199573, paid: 1, pending: 3, overdue: 1 });
    });

    it('labels counts in singular and plural', () => {
        expect(countLabel(1, 'paga', 'pagas')).toBe('1 paga');
        expect(countLabel(0, 'paga', 'pagas')).toBe('0 pagas');
        expect(countLabel(5, 'pendente', 'pendentes')).toBe('5 pendentes');
    });
});

describe('due this week (AC-0015-02)', () => {
    const roxinho = card({ id: 'c1', name: 'Nubank Roxinho' });
    const visa = card({ id: 'c2', name: 'Itaú Visa' });
    const farmacia = expense({
        id: 'e1',
        description: 'Farmácia',
        status: 'OVERDUE',
        occurredOn: '2026-10-08',
    });
    const internet = expense({ id: 'e2', description: 'Internet', occurredOn: TODAY });
    const condominio = expense({
        id: 'e3',
        description: 'Condomínio',
        status: 'VERIFYING',
        occurredOn: '2026-10-18',
    });
    const mercadoCartao = expense({
        id: 'e4',
        description: 'Mercado',
        bankAccountId: null,
        creditCardId: 'c1',
        occurredOn: '2026-10-16',
    });
    const luzPrevista = expense({
        id: 'e5',
        description: 'Luz',
        status: 'FORECAST',
        occurredOn: '2026-10-20',
    });
    const aluguelPago = expense({
        id: 'e6',
        description: 'Aluguel',
        status: 'PAID',
        occurredOn: '2026-10-16',
    });
    const closedRoxinho = statement({
        id: 's1',
        creditCardId: 'c1',
        status: 'CLOSED',
        dueOn: TODAY,
        remainingCents: 35000,
    });
    const items = dueThisWeek({
        overdue: [farmacia],
        // A vencida também volta na consulta da semana: aparece uma vez só.
        week: [condominio, farmacia, internet, mercadoCartao, luzPrevista, aluguelPago],
        statements: [
            {
                card: roxinho,
                statements: [
                    closedRoxinho,
                    statement({
                        id: null,
                        creditCardId: 'c1',
                        status: 'OPEN',
                        dueOn: '2026-11-15',
                    }),
                    statement({
                        id: 's2',
                        creditCardId: 'c1',
                        status: 'PAID',
                        dueOn: '2026-09-15',
                    }),
                ],
            },
            {
                card: visa,
                statements: [
                    statement({
                        id: 's3',
                        creditCardId: 'c2',
                        status: 'CLOSED',
                        dueOn: '2026-10-05',
                        remainingCents: 2550,
                        overdue: true,
                    }),
                    // Fechada a pagar, mas vence depois de hoje + 6.
                    statement({
                        id: 's4',
                        creditCardId: 'c2',
                        status: 'CLOSED',
                        dueOn: '2026-10-22',
                        remainingCents: 100,
                    }),
                    // Fechada e quitada.
                    statement({
                        id: 's5',
                        creditCardId: 'c2',
                        status: 'CLOSED',
                        dueOn: '2026-10-16',
                        remainingCents: 0,
                    }),
                ],
            },
        ],
        today: TODAY,
    });

    it('joins account expenses and closed statements to pay, by due date, without repeating ids', () => {
        expect(items.map((item) => item.description)).toEqual([
            'Fatura Itaú Visa',
            'Farmácia',
            'Fatura Nubank Roxinho',
            'Internet',
            'Condomínio',
        ]);
        expect(items.map((item) => item.key)).toEqual([
            'statement-s3',
            'expense-e1',
            'statement-s1',
            'expense-e2',
            'expense-e3',
        ]);
    });

    it('leaves card expenses, forecast and paid expenses out', () => {
        const keys = items.map((item) => item.key);
        expect(keys).not.toContain('expense-e4');
        expect(keys).not.toContain('expense-e5');
        expect(keys).not.toContain('expense-e6');
    });

    it('shows the expense amount and what is left to pay on the statement', () => {
        expect(items.map(dueAmount)).toEqual([2550, 10000, 35000, 10000, 10000]);
    });

    it('ends the week at today + 6', () => {
        expect(weekEnd(TODAY)).toBe('2026-10-21');
        expect(weekEnd('2026-12-28')).toBe('2027-01-03');
    });

    it('finds the closed statement to pay of a card', () => {
        expect(closedStatementToPay([closedRoxinho])).toBe(closedRoxinho);
        expect(
            closedStatementToPay([statement({ id: null, creditCardId: 'c1', status: 'OPEN' })]),
        ).toBeUndefined();
    });
});

describe('expenses by type (AC-0015-04)', () => {
    const type = (typeId: string, name: string, totalCents: number) => ({
        typeId,
        name,
        totalCents,
    });

    it('keeps the three largest types and sums the rest as Outros', () => {
        const report = byTypeReport([
            {
                month: '2026-10',
                totalCents: 403060,
                byType: [
                    type('t1', 'Moradia', 245000),
                    type('t2', 'Educação', 120000),
                    type('t3', 'Mercado', 23490),
                    type('t4', 'Lazer', 10000),
                    type('t5', 'Saúde', 4570),
                ],
            },
        ]);
        expect(topExpenseTypes(report, '2026-10')).toEqual([
            { key: 't1', label: 'Moradia', cents: 245000 },
            { key: 't2', label: 'Educação', cents: 120000 },
            { key: 't3', label: 'Mercado', cents: 23490 },
            { key: 'outros', label: OTHERS_LABEL, cents: 14570 },
        ]);
    });

    it('has no Outros with three types or fewer, and nothing for a missing month', () => {
        const report = byTypeReport([
            { month: '2026-10', totalCents: 3, byType: [type('t1', 'Moradia', 3)] },
        ]);
        expect(topExpenseTypes(report, '2026-10')).toEqual([
            { key: 't1', label: 'Moradia', cents: 3 },
        ]);
        expect(topExpenseTypes(report, '2026-11')).toEqual([]);
    });
});
