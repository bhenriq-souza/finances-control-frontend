import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { cardFormSearchShape, CreditCardPage } from '@/features/accounts';
import { StatementsPanel, statementsPanelSearchSchema } from '@/features/statements';

/**
 * Os parâmetros do painel de faturas (spec 0013) e `?editar=1`, que abre o formulário de alterar
 * o cartão (só com `accounts.write`); inválido é descartado.
 */
const searchSchema = statementsPanelSearchSchema.extend(cardFormSearchShape);

/** Resumo do cartão (spec 0011) com o painel de faturas (spec 0013), compostos aqui. */
export const Route = createFileRoute('/_app/cartoes/$cartaoId/')({
    validateSearch: searchSchema,
    component: CreditCard,
});

function CreditCard() {
    const { cartaoId } = Route.useParams();
    const { editar } = Route.useSearch();
    const navigate = useNavigate({ from: Route.fullPath });
    return (
        <CreditCardPage
            cardId={cartaoId}
            editing={editar === 1}
            onEditingChange={(editing) =>
                void navigate({ search: (prev) => ({ ...prev, editar: editing ? 1 : undefined }) })
            }
        >
            <StatementsPanel cardId={cartaoId} />
        </CreditCardPage>
    );
}
