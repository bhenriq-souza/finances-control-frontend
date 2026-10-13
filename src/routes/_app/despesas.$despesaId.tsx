import { createFileRoute } from '@tanstack/react-router';

import { ExpenseDetailPage, expenseDetailSearchSchema } from '@/features/expenses';

/** Detalhe de uma despesa (spec 0012). */
export const Route = createFileRoute('/_app/despesas/$despesaId')({
    validateSearch: expenseDetailSearchSchema,
    component: ExpenseDetail,
});

function ExpenseDetail() {
    const { despesaId } = Route.useParams();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <ExpenseDetailPage
            expenseId={despesaId}
            search={search}
            onSearchChange={(next) => void navigate({ search: (prev) => ({ ...prev, ...next }) })}
            onGone={() => void navigate({ to: '/despesas', search: {} })}
        />
    );
}
