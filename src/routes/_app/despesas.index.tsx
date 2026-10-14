import { createFileRoute } from '@tanstack/react-router';

import { ExpenseListPage, expenseListSearchSchema } from '@/features/expenses';

/** Lista de despesas do mês, com os filtros na URL (spec 0012). */
export const Route = createFileRoute('/_app/despesas/')({
    validateSearch: expenseListSearchSchema,
    component: ExpenseList,
});

function ExpenseList() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <ExpenseListPage
            search={search}
            onSearchChange={(next) => void navigate({ search: next })}
        />
    );
}
