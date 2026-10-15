import type { components } from '../../../src/api/generated/schema';

type Expense = components['schemas']['ExpenseResponse'];
type ExpenseType = components['schemas']['ExpenseTypeResponse'];
type BankAccount = components['schemas']['BankAccountResponse'];
type CreditCard = components['schemas']['CreditCardResponse'];
type Bank = components['schemas']['BankResponse'];

// Dados de exemplo das despesas (spec 0012), com o mínimo de contas, cartões e tipos que os filtros
// e os rótulos da lista usam. Os testes fixam "hoje" em 2026-10-20 (`EXPENSES_TODAY`).

export const EXPENSES_TODAY = '2026-10-20T12:00:00-03:00';

const CREATED = '2026-10-01T12:00:00Z';

const BANK: Bank = {
    id: '10000000-0000-4000-8000-000000000001',
    febrabanCode: '260',
    name: 'Nu Pagamentos',
    archivedAt: null,
    createdAt: CREATED,
};

export const EXPENSE_TYPES: ExpenseType[] = [
    {
        id: '20000000-0000-4000-8000-000000000001',
        name: 'Moradia',
        archivedAt: null,
        createdAt: CREATED,
    },
    {
        id: '20000000-0000-4000-8000-000000000002',
        name: 'Mercado',
        archivedAt: null,
        createdAt: CREATED,
    },
    {
        id: '20000000-0000-4000-8000-000000000003',
        name: 'Saúde',
        archivedAt: null,
        createdAt: CREATED,
    },
];

const [MORADIA, MERCADO, SAUDE] = EXPENSE_TYPES as [ExpenseType, ExpenseType, ExpenseType];

export const BANK_ACCOUNTS: BankAccount[] = [
    {
        id: '30000000-0000-4000-8000-000000000001',
        bank: BANK,
        type: 'CHECKING',
        accountNumber: '12345-6',
        description: 'Conta corrente',
        openingBalanceCents: 500000,
        currentBalanceCents: 320000,
        overdraftLimitCents: 0,
        archivedAt: null,
        createdAt: CREATED,
    },
];

export const CREDIT_CARDS: CreditCard[] = [
    {
        id: '40000000-0000-4000-8000-000000000001',
        bank: BANK,
        name: 'Nubank',
        creditLimitCents: 1000000,
        availableLimitCents: 936510,
        closingDay: 3,
        dueDay: 10,
        currentCycle: { startsOn: '2026-10-04', closesOn: '2026-11-03', dueOn: '2026-11-10' },
        paymentBankAccountId: '30000000-0000-4000-8000-000000000001',
        archivedAt: null,
        createdAt: CREATED,
    },
];

export const ACCOUNT_ID = BANK_ACCOUNTS[0]!.id;
export const CARD_ID = CREDIT_CARDS[0]!.id;
export const INSTALLMENT_GROUP_ID = '50000000-0000-4000-8000-000000000001';

function expense(fields: Partial<Expense> & Pick<Expense, 'id' | 'description'>): Expense {
    return {
        kind: 'VARIABLE',
        status: 'OPEN',
        amountCents: 10000,
        occurredOn: '2026-10-15',
        paidOn: null,
        notes: null,
        expenseType: MERCADO,
        bankAccountId: ACCOUNT_ID,
        creditCardId: null,
        postedOn: null,
        installment: null,
        recurrenceId: null,
        reconciledAt: null,
        createdAt: CREATED,
        updatedAt: CREATED,
        ...fields,
    };
}

/** As despesas de outubro de 2026, fora de ordem de propósito: a tela ordena por data. */
export const OCTOBER_EXPENSES: Expense[] = [
    expense({
        id: '60000000-0000-4000-8000-000000000004',
        description: 'Mercado',
        amountCents: 23490,
        occurredOn: '2026-10-15',
        bankAccountId: null,
        creditCardId: CARD_ID,
        postedOn: '2026-10-15',
    }),
    expense({
        id: '60000000-0000-4000-8000-000000000001',
        description: 'Aluguel',
        kind: 'FIXED',
        status: 'PAID',
        amountCents: 180000,
        occurredOn: '2026-10-05',
        paidOn: '2026-10-05',
        expenseType: MORADIA,
        recurrenceId: '70000000-0000-4000-8000-000000000001',
    }),
    expense({
        id: '60000000-0000-4000-8000-000000000006',
        description: 'Conta de luz',
        status: 'FORECAST',
        amountCents: 15000,
        occurredOn: '2026-10-25',
        expenseType: MORADIA,
    }),
    expense({
        id: '60000000-0000-4000-8000-000000000002',
        description: 'Farmácia',
        status: 'OVERDUE',
        amountCents: 4570,
        occurredOn: '2026-10-08',
        expenseType: SAUDE,
        notes: 'Remédio de pressão',
    }),
    expense({
        id: '60000000-0000-4000-8000-000000000005',
        description: 'Internet',
        amountCents: 9990,
        occurredOn: '2026-10-20',
        expenseType: MORADIA,
    }),
    expense({
        id: '60000000-0000-4000-8000-000000000003',
        description: 'Notebook',
        kind: 'INSTALLMENT',
        amountCents: 40000,
        occurredOn: '2026-10-10',
        bankAccountId: null,
        creditCardId: CARD_ID,
        postedOn: '2026-10-10',
        installment: { groupId: INSTALLMENT_GROUP_ID, number: 2, total: 3 },
    }),
];

/** A ordem que a lista mostra: por `occurredOn`, depois por descrição. */
export const OCTOBER_ORDER = [
    'Aluguel',
    'Farmácia',
    'Notebook',
    'Mercado',
    'Internet',
    'Conta de luz',
] as const;

export const NOTEBOOK = OCTOBER_EXPENSES.find(({ description }) => description === 'Notebook')!;
