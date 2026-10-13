import { createFileRoute } from '@tanstack/react-router';

import { StatementDetailPage, statementDetailSearchSchema } from '@/features/statements';

/** Detalhe de uma fatura persistida do cartão (spec 0013). */
export const Route = createFileRoute('/_app/cartoes/$cartaoId/faturas/$faturaId')({
    validateSearch: statementDetailSearchSchema,
    component: StatementDetail,
});

function StatementDetail() {
    const { cartaoId, faturaId } = Route.useParams();
    return <StatementDetailPage cardId={cartaoId} statementId={faturaId} />;
}
