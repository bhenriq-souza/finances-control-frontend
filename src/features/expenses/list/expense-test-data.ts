import type { Expense } from './expense-model';

// Dados dos testes unitários da feature; só os testes importam este arquivo.

export const ACCOUNT_ID = '30000000-0000-4000-8000-000000000001';
export const CARD_ID = '40000000-0000-4000-8000-000000000001';
export const TYPE_ID = '20000000-0000-4000-8000-000000000001';
export const GROUP_ID = '50000000-0000-4000-8000-000000000001';

export function expenseFixture(fields: Partial<Expense> = {}): Expense {
    return {
        id: '60000000-0000-4000-8000-000000000001',
        description: 'Mercado',
        kind: 'VARIABLE',
        status: 'OPEN',
        amountCents: 23490,
        occurredOn: '2026-10-15',
        paidOn: null,
        notes: null,
        expenseType: { id: TYPE_ID, name: 'Mercado', archivedAt: null, createdAt: '' },
        bankAccountId: ACCOUNT_ID,
        creditCardId: null,
        postedOn: null,
        installment: null,
        recurrenceId: null,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
        ...fields,
    };
}

export const ACCOUNTS = [
    { id: ACCOUNT_ID, description: 'Conta corrente', archivedAt: null },
    {
        id: '30000000-0000-4000-8000-000000000002',
        description: 'Poupança antiga',
        archivedAt: '2026-09-01T00:00:00Z',
    },
];

export const CARDS = [
    {
        id: CARD_ID,
        name: 'Nubank',
        archivedAt: null,
        currentCycle: { startsOn: '2026-10-04', closesOn: '2026-11-03', dueOn: '2026-11-10' },
    },
];

export const TYPES = [
    { id: TYPE_ID, name: 'Mercado', archivedAt: null },
    {
        id: '20000000-0000-4000-8000-000000000002',
        name: 'Viagem',
        archivedAt: '2026-09-01T00:00:00Z',
    },
];
