import { createFileRoute } from '@tanstack/react-router';

import { ReportsPage, reportsSearchSchema } from '@/features/reporting';

/** Relatórios de saldo, por tipo e fluxo de caixa (spec 0015). */
export const Route = createFileRoute('/_app/relatorios')({
    validateSearch: reportsSearchSchema,
    component: ReportsRoute,
});

function ReportsRoute() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <ReportsPage search={search} onSearchChange={(next) => void navigate({ search: next })} />
    );
}
