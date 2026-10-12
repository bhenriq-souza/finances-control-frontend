import { createFileRoute } from '@tanstack/react-router';

import { CreditCardPage } from '@/features/accounts';

/** Resumo do cartão (spec 0011); a spec 0013 acrescenta as faturas. */
export const Route = createFileRoute('/_app/cartoes/$cartaoId')({
    component: CreditCard,
});

function CreditCard() {
    const { cartaoId } = Route.useParams();
    return <CreditCardPage cardId={cartaoId} />;
}
