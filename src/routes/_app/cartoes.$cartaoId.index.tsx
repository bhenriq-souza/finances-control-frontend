import { createFileRoute } from '@tanstack/react-router';

import { CreditCardPage } from '@/features/accounts';
import { StatementsPanel, statementsPanelSearchSchema } from '@/features/statements';

/** Resumo do cartão (spec 0011) com o painel de faturas (spec 0013), compostos aqui. */
export const Route = createFileRoute('/_app/cartoes/$cartaoId/')({
    validateSearch: statementsPanelSearchSchema,
    component: CreditCard,
});

function CreditCard() {
    const { cartaoId } = Route.useParams();
    return (
        <CreditCardPage cardId={cartaoId}>
            <StatementsPanel cardId={cartaoId} />
        </CreditCardPage>
    );
}
