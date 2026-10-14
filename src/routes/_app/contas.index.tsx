import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';

import { BankAccountsPage, listFormSearchShape } from '@/features/accounts';

/**
 * `?arquivadas=1` mostra também as contas arquivadas; `?novo=1` e `?editar=<id>` abrem o
 * formulário (só com `accounts.write`); parâmetro inválido é descartado.
 */
const searchSchema = z.object({
    arquivadas: z.literal(1).optional().catch(undefined),
    ...listFormSearchShape,
});

/** Contas bancárias (spec 0011). */
export const Route = createFileRoute('/_app/contas/')({
    validateSearch: searchSchema,
    component: BankAccounts,
});

function BankAccounts() {
    const { arquivadas, novo, editar } = Route.useSearch();
    const navigate = useNavigate({ from: Route.fullPath });
    return (
        <BankAccountsPage
            showArchived={arquivadas === 1}
            onShowArchivedChange={(show) =>
                void navigate({
                    search: (prev) => ({ ...prev, arquivadas: show ? 1 : undefined }),
                    replace: true,
                })
            }
            form={{ novo, editar }}
            onFormChange={(form) =>
                void navigate({
                    search: (prev) => ({ ...prev, novo: form.novo, editar: form.editar }),
                })
            }
        />
    );
}
