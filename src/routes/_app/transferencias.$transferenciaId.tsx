import { createFileRoute } from '@tanstack/react-router';

import { TransferDetailPage, transferDetailSearchSchema } from '@/features/accounts';

/** Detalhe e ações de uma transferência (spec 0018). */
export const Route = createFileRoute('/_app/transferencias/$transferenciaId')({
    validateSearch: transferDetailSearchSchema,
    component: TransferDetailRoute,
});

function TransferDetailRoute() {
    const { transferenciaId } = Route.useParams();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <TransferDetailPage
            transferId={transferenciaId}
            search={search}
            onSearchChange={(next) => void navigate({ search: (prev) => ({ ...prev, ...next }) })}
            onDeleted={() => void navigate({ to: '/transferencias', search: {} })}
        />
    );
}
