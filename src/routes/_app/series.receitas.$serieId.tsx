import { createFileRoute } from '@tanstack/react-router';

import { EarningRecurrenceDetailPage, earningRecurrenceSearchSchema } from '@/features/earnings';

/** Detalhe de uma série de receita, com as ocorrências e **Encerrar série** (spec 0017). */
export const Route = createFileRoute('/_app/series/receitas/$serieId')({
    validateSearch: earningRecurrenceSearchSchema,
    component: EarningRecurrenceRoute,
});

function EarningRecurrenceRoute() {
    const { serieId } = Route.useParams();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <EarningRecurrenceDetailPage
            recurrenceId={serieId}
            search={search}
            onSearchChange={(next) => void navigate({ search: (prev) => ({ ...prev, ...next }) })}
        />
    );
}
