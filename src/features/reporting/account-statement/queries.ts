import { queryOptions } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import type { components } from '@/api/generated/schema';
import { ENTRY_STALE_TIME, queryKeys } from '@/api/queries/keys';
import { monthRange, type IsoMonth } from '@/shared/dates';

export type AccountMovementsReport = components['schemas']['AccountMovementsReport'];
export type AccountMovement = AccountMovementsReport['movements'][number];

/** `GET /reports/account-movements?bankAccountId&from&to` do mês, sob a raiz `reports`. */
export function accountMovementsQuery(bankAccountId: string, month: IsoMonth) {
    const query = { bankAccountId, ...monthRange(month) };
    return queryOptions({
        queryKey: queryKeys.reports.report('account-movements', { bankAccountId, mes: month }),
        queryFn: async (): Promise<AccountMovementsReport> => {
            const { data } = unwrap(
                await api.GET('/reports/account-movements', { params: { query } }),
            );
            if (!data) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
            return data;
        },
        staleTime: ENTRY_STALE_TIME,
    });
}
