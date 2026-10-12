import type { components } from '../../../src/api/generated/schema';

// Dados de exemplo de receitas para o e2e (spec 0014). As contas e os tipos citados ficam aqui
// mesmo, no mínimo necessário para os filtros e os rótulos.

type Schemas = components['schemas'];

const CREATED = '2026-01-01T12:00:00Z';

const BANK: Schemas['BankResponse'] = {
    id: '10000000-0000-4000-8000-000000000001',
    febrabanCode: '260',
    name: 'Nu Pagamentos',
    archivedAt: null,
    createdAt: CREATED,
};

function account(id: string, description: string): Schemas['BankAccountResponse'] {
    return {
        id,
        bank: BANK,
        type: 'CHECKING',
        accountNumber: '12345-6',
        description,
        openingBalanceCents: 0,
        currentBalanceCents: 0,
        overdraftLimitCents: 0,
        archivedAt: null,
        createdAt: CREATED,
    };
}

export const CHECKING_ACCOUNT = account('20000000-0000-4000-8000-000000000001', 'Conta corrente');
export const SAVINGS_ACCOUNT = account('20000000-0000-4000-8000-000000000002', 'Poupança');

function type(id: string, name: string): Schemas['EarningTypeResponse'] {
    return { id, name, archivedAt: null, createdAt: CREATED };
}

export const SALARY_TYPE = type('30000000-0000-4000-8000-000000000001', 'Salário');
export const FREELANCE_TYPE = type('30000000-0000-4000-8000-000000000002', 'Freela');

const INSTALLMENT_GROUP = '40000000-0000-4000-8000-000000000001';

function earning(
    fields: Pick<Schemas['EarningResponse'], 'id' | 'description' | 'amountCents' | 'occurredOn'> &
        Partial<Schemas['EarningResponse']>,
): Schemas['EarningResponse'] {
    return {
        kind: 'VARIABLE',
        status: 'OPEN',
        receivedOn: null,
        notes: null,
        earningType: SALARY_TYPE,
        bankAccountId: CHECKING_ACCOUNT.id,
        installment: null,
        recurrenceId: null,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
        ...fields,
    };
}

export const SALARY = earning({
    id: '50000000-0000-4000-8000-000000000001',
    description: 'Salário',
    kind: 'FIXED',
    status: 'RECEIVED',
    amountCents: 500000,
    occurredOn: '2026-10-05',
    receivedOn: '2026-10-05',
    recurrenceId: '60000000-0000-4000-8000-000000000001',
});

export const PROJECT_INSTALLMENT = earning({
    id: '50000000-0000-4000-8000-000000000002',
    description: 'Projeto site',
    kind: 'INSTALLMENT',
    status: 'OVERDUE',
    amountCents: 150000,
    occurredOn: '2026-10-08',
    earningType: FREELANCE_TYPE,
    bankAccountId: SAVINGS_ACCOUNT.id,
    installment: { groupId: INSTALLMENT_GROUP, number: 2, total: 3 },
    notes: 'Segunda parcela do site.',
});

export const ROOM_RENT = earning({
    id: '50000000-0000-4000-8000-000000000003',
    description: 'Aluguel da sala',
    status: 'FORECAST',
    amountCents: 80050,
    occurredOn: '2026-10-25',
});

/** As receitas de outubro de 2026, fora de ordem para provar a ordenação no cliente. */
export const OCTOBER_EARNINGS = [ROOM_RENT, SALARY, PROJECT_INSTALLMENT];

export const BANK_ACCOUNTS = [CHECKING_ACCOUNT, SAVINGS_ACCOUNT];
export const EARNING_TYPES = [SALARY_TYPE, FREELANCE_TYPE];
