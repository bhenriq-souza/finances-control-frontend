import type { components } from '../../../src/api/generated/schema';

// Dados de exemplo das transferências (spec 0018), tipados pelo contrato gerado. As contas são o
// mínimo para os rótulos e o formulário, declaradas aqui mesmo.

type BankAccount = components['schemas']['BankAccountResponse'];
type BankTransfer = components['schemas']['BankTransferResponse'];

export const CORRENTE_ID = '11111111-1111-4111-8111-111111111111';
export const POUPANCA_ID = '22222222-2222-4222-8222-222222222222';
export const COMPLETED_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const SCHEDULED_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const BANK: BankAccount['bank'] = {
    id: '99999999-9999-4999-8999-999999999999',
    febrabanCode: '260',
    name: 'Nu Pagamentos',
    archivedAt: null,
    createdAt: '2026-01-01T12:00:00Z',
};

function account(id: string, description: string, type: BankAccount['type']): BankAccount {
    return {
        id,
        bank: BANK,
        type,
        accountNumber: '12345-6',
        description,
        openingBalanceCents: 0,
        currentBalanceCents: 100000,
        overdraftLimitCents: 0,
        archivedAt: null,
        createdAt: '2026-01-01T12:00:00Z',
    };
}

export const ACCOUNTS: BankAccount[] = [
    account(CORRENTE_ID, 'Conta corrente', 'CHECKING'),
    account(POUPANCA_ID, 'Poupança', 'SAVINGS'),
];

export const COMPLETED_TRANSFER: BankTransfer = {
    id: COMPLETED_ID,
    fromBankAccountId: CORRENTE_ID,
    toBankAccountId: POUPANCA_ID,
    amountCents: 50000,
    occurredOn: '2026-10-05',
    status: 'COMPLETED',
    completedOn: '2026-10-05',
    description: 'Reserva do mês',
    notes: null,
    createdAt: '2026-10-05T12:00:00Z',
    updatedAt: '2026-10-05T12:00:00Z',
};

export const SCHEDULED_TRANSFER: BankTransfer = {
    id: SCHEDULED_ID,
    fromBankAccountId: POUPANCA_ID,
    toBankAccountId: CORRENTE_ID,
    amountCents: 12345,
    occurredOn: '2099-10-20',
    status: 'SCHEDULED',
    completedOn: null,
    description: 'Resgate',
    notes: 'Para o aluguel',
    createdAt: '2026-10-06T12:00:00Z',
    updatedAt: '2026-10-06T12:00:00Z',
};

export const TRANSFERS: BankTransfer[] = [COMPLETED_TRANSFER, SCHEDULED_TRANSFER];
