import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';

import { useCan } from '@/api/permissions';
import { formatDate } from '@/shared/dates';
import { Button } from '@/ui/components/ui/button';

import type { Statement, StatementPayment } from '../panel/statement-model';

import { MinimumDialog } from './minimum-dialog';
import { PayDialog } from './pay-dialog';
import { canPay, lastPayment } from './payment-model';
import { UndoPaymentDialog } from './undo-payment-dialog';

/** Os parâmetros de busca que abrem os diálogos destas ações (spec 0013, "Rotas"). */
type DialogParam = 'pagar' | 'minimo';

function useDialogParams() {
    const search: { pagar?: unknown; minimo?: unknown } = useSearch({ strict: false });
    const navigate = useNavigate();
    const set = (param: DialogParam, open: boolean) =>
        void navigate({
            to: '.',
            search: (prev: Record<string, unknown>) => ({ ...prev, [param]: open ? 1 : undefined }),
            replace: !open,
        });
    return {
        pagar: search.pagar === 1,
        minimo: search.minimo === 1,
        open: (param: DialogParam) => set(param, true),
        close: (param: DialogParam) => set(param, false),
    };
}

/**
 * Um diálogo só abre se a ação existe; aberto, fica aberto mesmo que a recarga da fatura a tire,
 * para o alerta do erro continuar à vista.
 */
function useLatchedOpen(requested: boolean, allowed: boolean): boolean {
    const [latched, setLatched] = useState(false);
    const open = requested && (allowed || latched);
    if (open !== latched) setLatched(open);
    return open;
}

export interface PaymentActions {
    /** **Pagar fatura** e **Informar mínimo**; `null` sem `entries.write`. */
    actions: ReactNode;
    /**
     * Os diálogos abertos, fora do conteúdo da fatura: continuam à vista quando a recarga depois
     * de um erro troca o conteúdo (ex.: `STATEMENT_NOT_FOUND`).
     */
    dialogs: ReactNode;
    /** **Desfazer** de uma linha de pagamento: só no último (INV-0013-02). */
    paymentAction?: (payment: StatementPayment) => ReactNode;
}

/**
 * As ações de pagamento de uma fatura (spec 0013, "Pagar", "Desfazer pagamento", "Mínimo"), só
 * com `entries.write` (AC-0013-09). `?pagar=1` e `?minimo=1` abrem os diálogos quando a ação
 * existe. **Informar mínimo** só na fatura persistida (com `id`).
 */
export function usePaymentActions(statement: Statement | undefined): PaymentActions {
    const writable = useCan('entries.write');
    const params = useDialogParams();
    const [undoing, setUndoing] = useState<StatementPayment | null>(null);

    const payable = writable && statement !== undefined && canPay(statement);
    const persisted =
        statement !== undefined && statement.id !== null
            ? { ...statement, id: statement.id }
            : undefined;
    const payOpen = useLatchedOpen(params.pagar, payable);
    const minimumOpen = useLatchedOpen(params.minimo, writable && persisted !== undefined);

    if (!writable || !statement) return { actions: null, dialogs: null };

    const last = lastPayment(statement.payments ?? []);
    return {
        actions: (payable || persisted) && (
            <div
                role="group"
                aria-label="Ações da fatura"
                className="flex flex-col gap-3 md:flex-row md:flex-wrap"
            >
                {payable && <Button onClick={() => params.open('pagar')}>Pagar fatura</Button>}
                {persisted && (
                    <Button variant="outline" onClick={() => params.open('minimo')}>
                        Informar mínimo
                    </Button>
                )}
            </div>
        ),
        dialogs: (
            <>
                {payOpen && (
                    <PayDialog statement={statement} onClose={() => params.close('pagar')} />
                )}
                {minimumOpen && persisted && (
                    <MinimumDialog statement={persisted} onClose={() => params.close('minimo')} />
                )}
                {undoing && (
                    <UndoPaymentDialog
                        statement={statement}
                        payment={undoing}
                        onClose={() => setUndoing(null)}
                    />
                )}
            </>
        ),
        paymentAction: (payment) =>
            payment.id === last?.id ? (
                <Button
                    variant="outline"
                    aria-label={`Desfazer pagamento de ${formatDate(payment.paidOn, 'curta')}`}
                    onClick={() => setUndoing(payment)}
                >
                    Desfazer
                </Button>
            ) : null,
    };
}
