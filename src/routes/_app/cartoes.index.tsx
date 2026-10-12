import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';

import { CreditCardsPage } from '@/features/accounts';

/** `?arquivados=1` mostra também os cartões arquivados; parâmetro inválido é descartado. */
const searchSchema = z.object({ arquivados: z.literal(1).optional().catch(undefined) });

/** Cartões de crédito (spec 0011). */
export const Route = createFileRoute('/_app/cartoes/')({
    validateSearch: searchSchema,
    component: CreditCards,
});

function CreditCards() {
    const { arquivados } = Route.useSearch();
    const navigate = useNavigate({ from: Route.fullPath });
    return (
        <CreditCardsPage
            showArchived={arquivados === 1}
            onShowArchivedChange={(show) =>
                void navigate({
                    search: (prev) => ({ ...prev, arquivados: show ? 1 : undefined }),
                    replace: true,
                })
            }
        />
    );
}
