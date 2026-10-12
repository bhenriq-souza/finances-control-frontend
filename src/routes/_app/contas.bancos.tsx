import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';

import { BanksPage } from '@/features/accounts';

/** `?arquivados=1` mostra também os bancos arquivados; parâmetro inválido é descartado. */
const searchSchema = z.object({ arquivados: z.literal(1).optional().catch(undefined) });

/** Bancos (spec 0011). */
export const Route = createFileRoute('/_app/contas/bancos')({
    validateSearch: searchSchema,
    component: Banks,
});

function Banks() {
    const { arquivados } = Route.useSearch();
    const navigate = useNavigate({ from: Route.fullPath });
    return (
        <BanksPage
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
