import type { BankAccount, EarningType } from '@/api/queries/reference';

import type { Earning } from './earning-model';

// Dados dos testes unitários de receitas.

export const SALARY_TYPE: EarningType = {
    id: 'tipo-salario',
    name: 'Salário',
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
};

export const FREELANCE_TYPE: EarningType = {
    id: 'tipo-freela',
    name: 'Freela',
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
};

export const OLD_TYPE: EarningType = {
    id: 'tipo-antigo',
    name: 'Aluguel recebido',
    archivedAt: '2026-05-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
};

function account(id: string, description: string, archivedAt: string | null): BankAccount {
    return {
        id,
        bank: {
            id: 'banco-1',
            febrabanCode: '001',
            name: 'Banco do Brasil',
            archivedAt: null,
            createdAt: '2026-01-01T00:00:00Z',
        },
        type: 'CHECKING',
        accountNumber: '12345-6',
        description,
        openingBalanceCents: 0,
        currentBalanceCents: 0,
        overdraftLimitCents: 0,
        archivedAt,
        createdAt: '2026-01-01T00:00:00Z',
    };
}

export const CHECKING = account('conta-corrente', 'Conta corrente', null);
export const SAVINGS = account('conta-poupanca', 'Poupança', null);
export const OLD_ACCOUNT = account('conta-antiga', 'Conta antiga', '2026-05-01T00:00:00Z');

export function earning(overrides: Partial<Earning> & Pick<Earning, 'id'>): Earning {
    return {
        description: 'Receita',
        kind: 'VARIABLE',
        status: 'OPEN',
        amountCents: 10000,
        occurredOn: '2026-10-10',
        receivedOn: null,
        notes: null,
        earningType: SALARY_TYPE,
        bankAccountId: CHECKING.id,
        installment: null,
        recurrenceId: null,
        createdAt: '2026-10-01T12:00:00Z',
        updatedAt: '2026-10-01T12:00:00Z',
        ...overrides,
    };
}
