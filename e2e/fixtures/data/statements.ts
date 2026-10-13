import type { StubRoute } from '../api';
import type { components } from '../../../src/api/generated/schema';

import { accountsReadRoutes, CONTA_CORRENTE, NUBANK_ROXINHO } from './accounts';

type Statement = components['schemas']['StatementResponse'];
type StatementExpense = components['schemas']['StatementExpenseResponse'];

// Dados do e2e das faturas (spec 0013), no cartão Nubank Roxinho de `accounts.ts`. Os testes fixam
// "hoje" em 2026-10-20 (`STATEMENTS_TODAY`).

export const STATEMENTS_TODAY = '2026-10-20T12:00:00-03:00';

export const CARD = NUBANK_ROXINHO;

const ELETRONICOS = { id: '30000000-0000-4000-8000-000000000101', name: 'Eletrônicos' };
const MERCADO = { id: '30000000-0000-4000-8000-000000000102', name: 'Mercado' };

export const NOTEBOOK: StatementExpense = {
    id: '60000000-0000-4000-8000-000000000101',
    description: 'Notebook',
    occurredOn: '2026-10-10',
    postedOn: '2026-10-10',
    amountCents: 40000,
    status: 'OPEN',
    expenseType: ELETRONICOS,
    installment: { groupId: '50000000-0000-4000-8000-000000000101', number: 2, total: 3 },
};

const FEIRA: StatementExpense = {
    id: '60000000-0000-4000-8000-000000000102',
    description: 'Feira',
    occurredOn: '2026-10-11',
    postedOn: '2026-10-11',
    amountCents: 12345,
    status: 'OPEN',
    expenseType: MERCADO,
    installment: null,
};

const BY_TYPE: Statement['byExpenseType'] = [
    { expenseTypeId: ELETRONICOS.id, name: ELETRONICOS.name, totalCents: 40000 },
    { expenseTypeId: MERCADO.id, name: MERCADO.name, totalCents: 12345 },
];

/** A fatura aberta de hoje, com o detalhe (despesas, um estorno, um pagamento antecipado). */
export const CURRENT: Statement = {
    id: null,
    creditCardId: CARD.id,
    status: 'OPEN',
    startsOn: '2026-10-09',
    closesOn: '2026-11-08',
    dueOn: '2026-11-15',
    purchasesCents: 52345,
    refundsCents: 2000,
    totalCents: 50345,
    previousBalanceCents: 0,
    amountDueCents: 50345,
    paidCents: 10000,
    remainingCents: 40345,
    minimumPaymentCents: null,
    overdue: false,
    closedAt: null,
    byExpenseType: BY_TYPE,
    expenses: [NOTEBOOK, FEIRA],
    refunds: [
        {
            id: '70000000-0000-4000-8000-000000000101',
            creditCardId: CARD.id,
            expenseId: FEIRA.id,
            description: 'Estorno da feira',
            amountCents: 2000,
            occurredOn: '2026-10-12',
            postedOn: '2026-10-12',
            notes: null,
            createdAt: '2026-10-12T12:00:00Z',
            updatedAt: '2026-10-12T12:00:00Z',
        },
    ],
    payments: [
        {
            id: '80000000-0000-4000-8000-000000000101',
            bankAccountId: CONTA_CORRENTE.id,
            amountCents: 10000,
            paidOn: '2026-10-15',
            createdAt: '2026-10-15T12:00:00Z',
        },
    ],
};

/** Fechada em outubro, vencida, com saldo anterior e mínimo informado. */
export const OCTOBER: Statement = {
    ...CURRENT,
    id: '40000000-0000-4000-8000-000000000110',
    status: 'CLOSED',
    startsOn: '2026-09-09',
    closesOn: '2026-10-08',
    dueOn: '2026-10-15',
    purchasesCents: 30000,
    refundsCents: 0,
    totalCents: 30000,
    previousBalanceCents: 5000,
    amountDueCents: 35000,
    paidCents: 0,
    remainingCents: 35000,
    minimumPaymentCents: 7000,
    overdue: true,
    closedAt: '2026-10-09T03:00:00Z',
    byExpenseType: [{ expenseTypeId: MERCADO.id, name: MERCADO.name, totalCents: 30000 }],
    expenses: undefined,
    refunds: undefined,
    payments: undefined,
};

/** Fechada em setembro, paga. */
export const SEPTEMBER: Statement = {
    ...OCTOBER,
    id: '40000000-0000-4000-8000-000000000109',
    status: 'PAID',
    startsOn: '2026-08-09',
    closesOn: '2026-09-08',
    dueOn: '2026-09-15',
    previousBalanceCents: 0,
    amountDueCents: 12000,
    paidCents: 12000,
    remainingCents: 0,
    minimumPaymentCents: null,
    overdue: false,
    closedAt: '2026-09-09T03:00:00Z',
};

/** `GET /statements/{id}` de outubro: com o detalhe. */
export const OCTOBER_DETAIL: Statement = {
    ...OCTOBER,
    expenses: [{ ...FEIRA, occurredOn: '2026-09-20', postedOn: '2026-09-20', amountCents: 30000 }],
    refunds: [],
    payments: [],
};

/** Projetadas (parcelas futuras), sem `id`: nunca têm link (INV-0013-03). */
export const UPCOMING: Statement[] = [
    {
        ...CURRENT,
        startsOn: '2026-11-09',
        closesOn: '2026-12-08',
        dueOn: '2026-12-15',
        purchasesCents: 40000,
        refundsCents: 0,
        totalCents: 40000,
        amountDueCents: 40000,
        paidCents: 0,
        remainingCents: 40000,
        byExpenseType: [BY_TYPE[0]!],
        expenses: undefined,
        refunds: undefined,
        payments: undefined,
    },
];

/** `GET /statements` sem janela: as fechadas (fora de ordem) e a aberta. */
export const LIST_WITHOUT_WINDOW: Statement[] = [SEPTEMBER, CURRENT, OCTOBER];

/**
 * Referências, a fatura atual e o detalhe de outubro. `GET /statements` responde pela query (sem
 * janela ou a janela das próximas), o que o `stubApi` não distingue: o spec o simula à parte.
 */
export const statementsReadRoutes: readonly StubRoute[] = [
    ...accountsReadRoutes,
    { method: 'GET', path: '/statements/current', body: { data: CURRENT } },
    { method: 'GET', path: `/statements/${OCTOBER.id}`, body: { data: OCTOBER_DETAIL } },
];
