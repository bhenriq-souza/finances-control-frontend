import { createFileRoute } from '@tanstack/react-router';

import { ExpenseDetailPage, expenseDetailSearchSchema } from '@/features/expenses';

/** Detalhe de uma despesa (spec 0012). */
export const Route = createFileRoute('/_app/despesas/$despesaId')({
    validateSearch: expenseDetailSearchSchema,
    component: ExpenseDetail,
});

function ExpenseDetail() {
    const { despesaId } = Route.useParams();
    return <ExpenseDetailPage expenseId={despesaId} />;
}
