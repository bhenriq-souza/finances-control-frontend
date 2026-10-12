import { createFileRoute } from '@tanstack/react-router';

import { TransfersPage, transfersSearchSchema } from '@/features/accounts';

/** Lista de transferências do mês (spec 0018). */
export const Route = createFileRoute('/_app/transferencias/')({
    validateSearch: transfersSearchSchema,
    component: TransfersRoute,
});

function TransfersRoute() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <TransfersPage
            search={search}
            onSearchChange={(next) => void navigate({ search: (prev) => ({ ...prev, ...next }) })}
        />
    );
}
