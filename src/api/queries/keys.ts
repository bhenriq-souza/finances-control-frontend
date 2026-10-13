/** Valor de um parâmetro de query como o cliente o envia; `undefined` é parâmetro ausente. */
export type QueryParamValue = string | number | boolean | null | undefined;

/** Parâmetros de query de uma consulta (filtros de lista, janela de faturas, parâmetros de relatório). */
export type QueryParams = Readonly<Record<string, QueryParamValue>>;

/** Parâmetros normalizados: sem os ausentes e com as propriedades em ordem alfabética. */
export type NormalizedParams = Readonly<Record<string, Exclude<QueryParamValue, undefined>>>;

/**
 * Exatamente os parâmetros enviados, os ausentes omitidos e as propriedades ordenadas: a mesma
 * consulta tem a mesma chave em qualquer tela e em qualquer ordem de propriedades (spec 0009).
 */
export function normalizeParams(params: QueryParams = {}): NormalizedParams {
    const normalized: Record<string, Exclude<QueryParamValue, undefined>> = {};
    for (const name of Object.keys(params).sort()) {
        const value = params[name];
        if (value !== undefined) normalized[name] = value;
    }
    return normalized;
}

/** Raízes das chaves; `invalidateAfter` invalida por elas. */
export type QueryRoot =
    | 'users'
    | 'banks'
    | 'bank-accounts'
    | 'credit-cards'
    | 'expense-types'
    | 'earning-types'
    | 'expenses'
    | 'earnings'
    | 'statements'
    | 'credit-card-refunds'
    | 'bank-transfers'
    | 'expense-recurrences'
    | 'earning-recurrences'
    | 'reports';

export type ReportKind =
    'balance' | 'expenses-by-type' | 'earnings-by-type' | 'cash-flow' | 'account-movements';

function entryKeys<const R extends QueryRoot>(root: R) {
    return {
        all: [root] as const,
        list: (filters?: QueryParams) => [root, 'list', normalizeParams(filters)] as const,
        detail: (id: string) => [root, 'detail', id] as const,
    };
}

/** Fábrica de chaves de todas as consultas do TanStack Query (spec 0009, tabela "Chaves"). */
export const queryKeys = {
    users: {
        all: ['users'] as const,
        me: () => ['users', 'me'] as const,
        list: () => ['users', 'list'] as const,
    },
    banks: { all: ['banks'] as const },
    bankAccounts: { all: ['bank-accounts'] as const },
    creditCards: { all: ['credit-cards'] as const },
    expenseTypes: { all: ['expense-types'] as const },
    earningTypes: { all: ['earning-types'] as const },
    expenses: entryKeys('expenses'),
    earnings: entryKeys('earnings'),
    statements: {
        all: ['statements'] as const,
        list: (creditCardId: string, window?: QueryParams) =>
            ['statements', 'list', creditCardId, normalizeParams(window)] as const,
        current: (creditCardId: string) => ['statements', 'current', creditCardId] as const,
        detail: (id: string) => ['statements', 'detail', id] as const,
    },
    creditCardRefunds: entryKeys('credit-card-refunds'),
    bankTransfers: entryKeys('bank-transfers'),
    expenseRecurrences: entryKeys('expense-recurrences'),
    earningRecurrences: entryKeys('earning-recurrences'),
    reports: {
        all: ['reports'] as const,
        report: (kind: ReportKind, params?: QueryParams) =>
            ['reports', kind, normalizeParams(params)] as const,
    },
} as const;

/** 5 minutos: consultas de referência e usuário atual. */
export const REFERENCE_STALE_TIME = 5 * 60 * 1000;

/** 30 segundos: listas e detalhes de lançamentos, faturas e relatórios. */
export const ENTRY_STALE_TIME = 30 * 1000;
