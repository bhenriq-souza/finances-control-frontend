import { queryOptions } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import { ENTRY_STALE_TIME, queryKeys } from '@/api/queries/keys';
import type { IsoMonth } from '@/shared/dates';

import type { Earning, Statement } from './cash-flow-model';
import { statementWindow } from './cash-flow-model';

// As consultas do fluxo de caixa (spec 0015) que o dashboard e os relatórios ainda não têm, com as
// mesmas chaves das outras telas (spec 0009), para que o cache seja um só. As demais (receitas e
// despesas do mês, vencidas, saldo) vêm de `dashboard/` e `reports/`.

function required<T>(data: T | undefined): T {
    if (data === undefined) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
    return data;
}

/** `GET /earnings?status=OVERDUE`: as receitas vencidas de qualquer mês. */
export const overdueEarningsQuery = queryOptions({
    queryKey: queryKeys.earnings.list({ status: 'OVERDUE' }),
    queryFn: async (): Promise<Earning[]> =>
        required(
            unwrap(await api.GET('/earnings', { params: { query: { status: 'OVERDUE' } } })).data,
        ),
    staleTime: ENTRY_STALE_TIME,
});

/** `GET /statements?creditCardId&from=<1º dia de mes−2>&to=<último dia de mes>`. */
export function monthStatementsQuery(creditCardId: string, month: IsoMonth) {
    const window = statementWindow(month);
    return queryOptions({
        queryKey: queryKeys.statements.list(creditCardId, window),
        queryFn: async (): Promise<Statement[]> =>
            required(
                unwrap(
                    await api.GET('/statements', {
                        params: { query: { creditCardId, ...window } },
                    }),
                ).data,
            ),
        staleTime: ENTRY_STALE_TIME,
    });
}
