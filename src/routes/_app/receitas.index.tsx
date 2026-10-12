import { createFileRoute } from '@tanstack/react-router';

import { EarningListPage, earningListSearchSchema } from '@/features/earnings';

/** Lista de receitas do mês, com filtros e resumo (spec 0014). */
export const Route = createFileRoute('/_app/receitas/')({
    validateSearch: earningListSearchSchema,
    component: EarningList,
});

function EarningList() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <EarningListPage
            search={search}
            onSearchChange={(next) => void navigate({ search: next })}
        />
    );
}
