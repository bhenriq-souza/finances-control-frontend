import type { StubRoute } from '../api';
import type { components } from '../../../src/api/generated/schema';

type Bank = components['schemas']['BankResponse'];
type BankAccount = components['schemas']['BankAccountResponse'];
type CreditCard = components['schemas']['CreditCardResponse'];

// Dados do e2e da spec 0011: bancos, contas e cartões, cada um com um arquivado, fora de ordem.

export const ITAU = {
    id: '20000000-0000-4000-8000-000000000001',
    febrabanCode: '341',
    name: 'Itaú',
    archivedAt: null,
    createdAt: '2026-01-10T12:00:00Z',
} as const satisfies Bank;

export const NUBANK = {
    id: '20000000-0000-4000-8000-000000000002',
    febrabanCode: '260',
    name: 'Nubank',
    archivedAt: null,
    createdAt: '2026-01-10T12:00:00Z',
} as const satisfies Bank;

export const BANCO_DO_BRASIL = {
    id: '20000000-0000-4000-8000-000000000003',
    febrabanCode: '001',
    name: 'Banco do Brasil',
    archivedAt: '2026-09-01T12:00:00Z',
    createdAt: '2026-01-10T12:00:00Z',
} as const satisfies Bank;

export const BANKS = [NUBANK, BANCO_DO_BRASIL, ITAU] as const satisfies readonly Bank[];

export const CONTA_CORRENTE = {
    id: '21000000-0000-4000-8000-000000000001',
    bank: ITAU,
    type: 'CHECKING',
    accountNumber: '12345-6',
    description: 'Conta corrente',
    openingBalanceCents: 100000,
    currentBalanceCents: -12345,
    overdraftLimitCents: 100000,
    archivedAt: null,
    createdAt: '2026-01-10T12:00:00Z',
} as const satisfies BankAccount;

export const POUPANCA = {
    id: '21000000-0000-4000-8000-000000000002',
    bank: NUBANK,
    type: 'SAVINGS',
    accountNumber: '98765-4',
    description: 'Poupança',
    openingBalanceCents: 300000,
    currentBalanceCents: 500000,
    overdraftLimitCents: 0,
    archivedAt: null,
    createdAt: '2026-01-10T12:00:00Z',
} as const satisfies BankAccount;

export const INVESTIMENTO_ANTIGO = {
    id: '21000000-0000-4000-8000-000000000003',
    bank: BANCO_DO_BRASIL,
    type: 'INVESTMENT',
    accountNumber: '55555-0',
    description: 'Investimento antigo',
    openingBalanceCents: 0,
    currentBalanceCents: 999900,
    overdraftLimitCents: 0,
    archivedAt: '2026-09-01T12:00:00Z',
    createdAt: '2026-01-10T12:00:00Z',
} as const satisfies BankAccount;

export const BANK_ACCOUNTS = [
    POUPANCA,
    INVESTIMENTO_ANTIGO,
    CONTA_CORRENTE,
] as const satisfies readonly BankAccount[];

/** Soma dos saldos das contas ativas: `500000 + (−12345)`. */
export const ACTIVE_BALANCE_TEXT = 'R$ 4.876,55';

export const NUBANK_ROXINHO = {
    id: '22000000-0000-4000-8000-000000000001',
    bank: NUBANK,
    name: 'Nubank Roxinho',
    creditLimitCents: 500000,
    availableLimitCents: 350000,
    closingDay: 8,
    dueDay: 15,
    currentCycle: { startsOn: '2026-09-09', closesOn: '2026-10-08', dueOn: '2026-10-15' },
    paymentBankAccountId: CONTA_CORRENTE.id,
    archivedAt: null,
    createdAt: '2026-01-10T12:00:00Z',
} as const satisfies CreditCard;

/** Limite estourado: o disponível é negativo. */
export const ITAU_VISA = {
    id: '22000000-0000-4000-8000-000000000002',
    bank: ITAU,
    name: 'Itaú Visa',
    creditLimitCents: 100000,
    availableLimitCents: -2550,
    closingDay: 25,
    dueDay: 5,
    currentCycle: { startsOn: '2026-09-26', closesOn: '2026-10-25', dueOn: '2026-11-05' },
    paymentBankAccountId: null,
    archivedAt: null,
    createdAt: '2026-01-10T12:00:00Z',
} as const satisfies CreditCard;

export const CARTAO_ANTIGO = {
    id: '22000000-0000-4000-8000-000000000003',
    bank: BANCO_DO_BRASIL,
    name: 'Cartão antigo',
    creditLimitCents: 200000,
    availableLimitCents: 200000,
    closingDay: 1,
    dueDay: 10,
    currentCycle: { startsOn: '2026-10-02', closesOn: '2026-11-01', dueOn: '2026-11-10' },
    paymentBankAccountId: INVESTIMENTO_ANTIGO.id,
    archivedAt: '2026-09-01T12:00:00Z',
    createdAt: '2026-01-10T12:00:00Z',
} as const satisfies CreditCard;

export const CREDIT_CARDS = [
    NUBANK_ROXINHO,
    CARTAO_ANTIGO,
    ITAU_VISA,
] as const satisfies readonly CreditCard[];

/** `GET /banks`, `GET /bank-accounts` e `GET /credit-cards` (todas com `archived=true`). */
export const accountsReadRoutes: readonly StubRoute[] = [
    { method: 'GET', path: '/banks', body: { data: BANKS } satisfies { data: readonly Bank[] } },
    {
        method: 'GET',
        path: '/bank-accounts',
        body: { data: BANK_ACCOUNTS } satisfies { data: readonly BankAccount[] },
    },
    {
        method: 'GET',
        path: '/credit-cards',
        body: { data: CREDIT_CARDS } satisfies { data: readonly CreditCard[] },
    },
];
