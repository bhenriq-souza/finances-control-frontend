import { ConfirmDialog } from '@/ui/confirm-dialog';
import { FormAlert } from '@/ui/form-alert';
import { useNotify } from '@/ui/notice';

import { asApiError, type Statement, type StatementPayment } from '../panel/statement-model';

import { useUndoPayment } from './payment-api';

export const UNDO_NOTICE = 'Pagamento desfeito.';

export interface UndoPaymentDialogProps {
    statement: Statement;
    payment: StatementPayment;
    onClose: () => void;
}

/**
 * **Desfazer pagamento** (spec 0013): confirma e envia o `DELETE` da rota da fatura (aberta ou
 * fechada). Um erro da API fica no alerta, com o diálogo aberto.
 */
export function UndoPaymentDialog({ statement, payment, onClose }: UndoPaymentDialogProps) {
    const notify = useNotify();
    const undo = useUndoPayment(statement);
    const confirm = () =>
        undo.mutate(payment.id, {
            onSuccess: () => {
                onClose();
                notify({ tone: 'sucesso', message: UNDO_NOTICE });
            },
        });

    return (
        <ConfirmDialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title="Desfazer pagamento?"
            description="O valor volta para a conta e a fatura fica com o restante de novo."
            confirmLabel="Desfazer pagamento"
            onConfirm={confirm}
            pending={undo.isPending}
        >
            <FormAlert message={undo.error ? asApiError(undo.error).userMessage : null} />
        </ConfirmDialog>
    );
}
