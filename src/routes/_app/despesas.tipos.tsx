import { createFileRoute } from '@tanstack/react-router';

import { ExpenseTypesPage, parseExpenseTypesSearch } from '@/features/expenses';

/** Tipos de despesa (spec 0012): busca `arquivados`, `novo`, `editar`, validada pelo zod. */
export const Route = createFileRoute('/_app/despesas/tipos')({
    validateSearch: parseExpenseTypesSearch,
    component: ExpenseTypes,
});

function ExpenseTypes() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <ExpenseTypesPage
            search={search}
            onSearchChange={(next) => void navigate({ search: next })}
        />
    );
}
