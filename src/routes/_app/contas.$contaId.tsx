import { createFileRoute } from '@tanstack/react-router';

import { AccountStatementPage, accountStatementSearchSchema } from '@/features/reporting';

/** Extrato de uma conta (spec 0015): `?mes=YYYY-MM`, inválido descartado. */
export const Route = createFileRoute('/_app/contas/$contaId')({
    validateSearch: accountStatementSearchSchema,
    component: AccountStatementRoute,
});

function AccountStatementRoute() {
    const { contaId } = Route.useParams();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
        <AccountStatementPage
            bankAccountId={contaId}
            search={search}
            onSearchChange={(next) => void navigate({ search: next })}
        />
    );
}
