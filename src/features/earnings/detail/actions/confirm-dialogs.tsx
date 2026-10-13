import { useNavigate } from '@tanstack/react-router';

import { ConfirmDialog } from '@/ui/confirm-dialog';
import { FormAlert } from '@/ui/form-alert';
import { useNotify } from '@/ui/notice';

import type { Earning } from '../../list/earning-model';
import { asApiError } from '../../list/earnings-query';

import { useChangeEarningStatus, useDeleteEarning } from './api';
import { ACTION_NOTICES, deleteCascade } from './transitions';

export interface EarningDialogProps {
    earning: Earning;
    onClose: () => void;
}

function close(onClose: () => void) {
    return (open: boolean) => {
        if (!open) onClose();
    };
}

/**
 * O erro de uma confirmação fica no `FormAlert` do diálogo, que continua aberto; um conflito de
 * status também recarrega o detalhe (`isStaleEarningError`, em `./api`).
 */
function alertMessage(error: Error | null): string | null {
    return error ? asApiError(error).userMessage : null;
}

/**
 * **Desfazer recebimento** (spec 0014): confirma "O valor sai do saldo da conta." e envia
 * `{ status: 'OPEN' }`. Um erro da API fica no alerta, com o diálogo aberto.
 */
export function UndoReceiptDialog({ earning, onClose }: EarningDialogProps) {
    const notify = useNotify();
    const change = useChangeEarningStatus();
    const confirm = () =>
        change.mutate(
            { id: earning.id, body: { status: 'OPEN' } },
            {
                onSuccess: () => {
                    onClose();
                    notify({ tone: 'sucesso', message: ACTION_NOTICES.desfazer });
                },
            },
        );

    return (
        <ConfirmDialog
            open
            onOpenChange={close(onClose)}
            title="Desfazer recebimento?"
            description="O valor sai do saldo da conta."
            confirmLabel="Desfazer recebimento"
            onConfirm={confirm}
            pending={change.isPending}
        >
            <FormAlert message={alertMessage(change.error)} />
        </ConfirmDialog>
    );
}

/**
 * **Excluir** (spec 0014): mostra a cascata antes de enviar (INV-0014-03) → `DELETE
 * /earnings/{id}`; no sucesso, volta para a lista.
 */
export function DeleteEarningDialog({ earning, onClose }: EarningDialogProps) {
    const notify = useNotify();
    const navigate = useNavigate();
    const remove = useDeleteEarning();
    const confirm = () =>
        remove.mutate(earning.id, {
            onSuccess: () => {
                notify({ tone: 'sucesso', message: 'Receita excluída.' });
                void navigate({ to: '/receitas' });
            },
        });

    return (
        <ConfirmDialog
            open
            onOpenChange={close(onClose)}
            title="Excluir receita?"
            description={deleteCascade(earning)}
            confirmLabel="Excluir"
            onConfirm={confirm}
            destructive
            pending={remove.isPending}
        >
            <FormAlert message={alertMessage(remove.error)} />
        </ConfirmDialog>
    );
}
