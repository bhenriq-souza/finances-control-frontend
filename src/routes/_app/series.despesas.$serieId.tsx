import { createFileRoute } from '@tanstack/react-router';

import { ExpenseRecurrenceDetailPage, expenseRecurrenceSearchSchema } from '@/features/expenses';

/** Detalhe de uma série de despesa, com as ocorrências e **Encerrar série** (spec 0017). */
export const Route = createFileRoute('/_app/series/despesas/$serieId')({
    validateSearch: expenseRecurrenceSearchSchema,
    component: ExpenseRecurrenceRoute,
});

function ExpenseRecurrenceRoute() {
    const { serieId } = Route.useParams();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <ExpenseRecurrenceDetailPage
            recurrenceId={serieId}
            search={search}
            onSearchChange={(next) => void navigate({ search: (prev) => ({ ...prev, ...next }) })}
        />
    );
}
