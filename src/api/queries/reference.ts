import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '../client';
import { ApiError, unwrap } from '../errors/api-error';
import type { components } from '../generated/schema';

import { queryKeys, REFERENCE_STALE_TIME } from './keys';

export type Bank = components['schemas']['BankResponse'];
export type BankAccount = components['schemas']['BankAccountResponse'];
export type CreditCard = components['schemas']['CreditCardResponse'];
export type ExpenseType = components['schemas']['ExpenseTypeResponse'];
export type EarningType = components['schemas']['EarningTypeResponse'];

/** Toda consulta de referência pede os arquivados: as telas filtram os ativos no cliente. */
const WITH_ARCHIVED = { params: { query: { archived: 'true' } } } as const;

function listData<T>(body: { data?: T[] }): T[] {
    if (!body.data) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
    return body.data;
}

/** `GET /banks?archived=true`, chave `['banks']`. */
export const banksQuery = queryOptions({
    queryKey: queryKeys.banks.all,
    queryFn: async (): Promise<Bank[]> => listData(unwrap(await api.GET('/banks', WITH_ARCHIVED))),
    staleTime: REFERENCE_STALE_TIME,
});

/** `GET /bank-accounts?archived=true`, chave `['bank-accounts']`. */
export const bankAccountsQuery = queryOptions({
    queryKey: queryKeys.bankAccounts.all,
    queryFn: async (): Promise<BankAccount[]> =>
        listData(unwrap(await api.GET('/bank-accounts', WITH_ARCHIVED))),
    staleTime: REFERENCE_STALE_TIME,
});

/** `GET /credit-cards?archived=true`, chave `['credit-cards']`. */
export const creditCardsQuery = queryOptions({
    queryKey: queryKeys.creditCards.all,
    queryFn: async (): Promise<CreditCard[]> =>
        listData(unwrap(await api.GET('/credit-cards', WITH_ARCHIVED))),
    staleTime: REFERENCE_STALE_TIME,
});

/** `GET /expense-types?archived=true`, chave `['expense-types']`. */
export const expenseTypesQuery = queryOptions({
    queryKey: queryKeys.expenseTypes.all,
    queryFn: async (): Promise<ExpenseType[]> =>
        listData(unwrap(await api.GET('/expense-types', WITH_ARCHIVED))),
    staleTime: REFERENCE_STALE_TIME,
});

/** `GET /earning-types?archived=true`, chave `['earning-types']`. */
export const earningTypesQuery = queryOptions({
    queryKey: queryKeys.earningTypes.all,
    queryFn: async (): Promise<EarningType[]> =>
        listData(unwrap(await api.GET('/earning-types', WITH_ARCHIVED))),
    staleTime: REFERENCE_STALE_TIME,
});

export const useBanks = () => useQuery(banksQuery);
export const useBankAccounts = () => useQuery(bankAccountsQuery);
export const useCreditCards = () => useQuery(creditCardsQuery);
export const useExpenseTypes = () => useQuery(expenseTypesQuery);
export const useEarningTypes = () => useQuery(earningTypesQuery);
