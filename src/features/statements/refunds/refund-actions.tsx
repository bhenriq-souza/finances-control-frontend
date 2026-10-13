import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';

import { useCan } from '@/api/permissions';
import { Button } from '@/ui/components/ui/button';

import type { StatementRefund } from '../panel/statement-model';

import { DeleteRefundDialog, EditRefundDialog, NewRefundDialog } from './refund-dialogs';

export interface RefundActionSlots {
    /** **Novo estorno**; `null` sem `entries.write`. */
    newRefund: ReactNode;
    /** **Editar** e **Excluir** de uma linha; ausente sem `entries.write`. */
    rowActions?: (refund: StatementRefund) => ReactNode;
}

export interface RefundActionsProps {
    cardId: string;
    /** A tela, com as peças das ações nos seus lugares. */
    children: (slots: RefundActionSlots) => ReactNode;
}

type Selected = { mode: 'edit' | 'delete'; refund: StatementRefund };

/**
 * `?estorno=1` (e `?despesa=<id>`, no painel) abre o **Novo estorno**; fechar tira os dois da URL.
 */
function useNewRefundParams() {
    const search: { estorno?: unknown; despesa?: unknown } = useSearch({ strict: false });
    const navigate = useNavigate();
    const set = (open: boolean) =>
        void navigate({
            to: '.',
            search: (prev: { despesa?: string }) => ({
                ...prev,
                estorno: open ? (1 as const) : undefined,
                despesa: open ? prev.despesa : undefined,
            }),
            replace: !open,
        });
    return {
        open: search.estorno === 1,
        expenseId: typeof search.despesa === 'string' ? search.despesa : undefined,
        set,
    };
}

/**
 * As ações de estorno de uma fatura (spec 0013, "Estornos"), só com `entries.write`
 * (INV-0009-03): **Novo estorno** (também por `?estorno=1[&despesa=<id>]`), e **Editar** e
 * **Excluir** em cada estorno. Os diálogos ficam aqui, fora da lista: um erro que recarrega a
 * fatura (o estorno sumiu) não fecha o diálogo nem apaga o alerta.
 */
export function RefundActions({ cardId, children }: RefundActionsProps) {
    const canWrite = useCan('entries.write');
    if (!canWrite) return <>{children({ newRefund: null })}</>;
    return <WriterRefundActions cardId={cardId}>{children}</WriterRefundActions>;
}

function WriterRefundActions({ cardId, children }: RefundActionsProps) {
    const params = useNewRefundParams();
    const [selected, setSelected] = useState<Selected | null>(null);
    const close = () => setSelected(null);

    const slots: RefundActionSlots = {
        newRefund: (
            <Button variant="outline" onClick={() => params.set(true)}>
                Novo estorno
            </Button>
        ),
        rowActions: (refund) => (
            <div className="flex flex-wrap justify-end gap-2">
                <Button
                    variant="outline"
                    aria-label={`Editar ${refund.description}`}
                    onClick={() => setSelected({ mode: 'edit', refund })}
                >
                    Editar
                </Button>
                <Button
                    variant="outline"
                    aria-label={`Excluir ${refund.description}`}
                    onClick={() => setSelected({ mode: 'delete', refund })}
                >
                    Excluir
                </Button>
            </div>
        ),
    };

    return (
        <>
            {children(slots)}
            {params.open && (
                <NewRefundDialog
                    cardId={cardId}
                    expenseId={params.expenseId}
                    onClose={() => params.set(false)}
                />
            )}
            {selected?.mode === 'edit' && (
                <EditRefundDialog refund={selected.refund} onClose={close} />
            )}
            {selected?.mode === 'delete' && (
                <DeleteRefundDialog refund={selected.refund} onClose={close} />
            )}
        </>
    );
}
