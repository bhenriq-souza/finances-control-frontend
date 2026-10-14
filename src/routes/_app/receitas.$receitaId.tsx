import { createFileRoute } from '@tanstack/react-router';

import { EarningDetail, earningDetailSearchSchema } from '@/features/earnings';

/** Detalhe de uma receita (spec 0014). */
export const Route = createFileRoute('/_app/receitas/$receitaId')({
    validateSearch: earningDetailSearchSchema,
    component: Earning,
});

function Earning() {
    const { receitaId } = Route.useParams();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <EarningDetail
            earningId={receitaId}
            search={search}
            onSearchChange={(next) => void navigate({ search: (prev) => ({ ...prev, ...next }) })}
        />
    );
}
