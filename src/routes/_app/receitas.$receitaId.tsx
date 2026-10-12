import { createFileRoute } from '@tanstack/react-router';

import { EarningDetail, earningDetailSearchSchema } from '@/features/earnings';

/** Detalhe de uma receita (spec 0014). */
export const Route = createFileRoute('/_app/receitas/$receitaId')({
    validateSearch: earningDetailSearchSchema,
    component: Earning,
});

function Earning() {
    const { receitaId } = Route.useParams();
    return <EarningDetail earningId={receitaId} />;
}
