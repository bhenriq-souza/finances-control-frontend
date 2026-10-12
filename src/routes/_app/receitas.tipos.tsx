import { createFileRoute } from '@tanstack/react-router';

import { EarningTypesPage, parseEarningTypesSearch } from '@/features/earnings';

/** Tipos de receita (spec 0014): `?arquivados=1`, `?novo=1`, `?editar=<id>`. */
export const Route = createFileRoute('/_app/receitas/tipos')({
    validateSearch: parseEarningTypesSearch,
    component: EarningTypesRoute,
});

function EarningTypesRoute() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <EarningTypesPage
            search={search}
            onSearchChange={(next) => void navigate({ search: next })}
        />
    );
}
