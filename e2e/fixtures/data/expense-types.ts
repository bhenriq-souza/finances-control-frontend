import type { components } from '../../../src/api/generated/schema';

type ExpenseType = components['schemas']['ExpenseTypeResponse'];

/** Tipos de despesa do e2e (spec 0012): dois ativos e um arquivado, fora de ordem de nome. */
export const EXPENSE_TYPES = [
    {
        id: '10000000-0000-4000-8000-000000000001',
        name: 'Moradia',
        archivedAt: null,
        createdAt: '2026-10-01T12:00:00Z',
    },
    {
        id: '10000000-0000-4000-8000-000000000002',
        name: 'Academia',
        archivedAt: '2026-09-15T12:00:00Z',
        createdAt: '2026-01-10T12:00:00Z',
    },
    {
        id: '10000000-0000-4000-8000-000000000003',
        name: 'Mercado',
        archivedAt: null,
        createdAt: '2026-10-01T12:00:00Z',
    },
] as const satisfies readonly ExpenseType[];

export const [MORADIA, ACADEMIA, MERCADO] = EXPENSE_TYPES;

/** Corpo `200` de `GET /expense-types?archived=true`. */
export const expenseTypesResponse = { data: EXPENSE_TYPES } satisfies {
    data: readonly ExpenseType[];
};

/** Corpo de sucesso de uma escrita num tipo (`201`/`200`, resposta `ExpenseType`). */
export function expenseTypeResponse(type: ExpenseType) {
    return { data: type } satisfies { data: ExpenseType };
}

export const expenseTypeAlreadyExists = {
    error: { code: 'EXPENSE_TYPE_ALREADY_EXISTS', message: 'Expense type already exists' },
} satisfies components['schemas']['Error'];
