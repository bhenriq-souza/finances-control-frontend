import { useNavigate } from '@tanstack/react-router';

import { ConfirmDialog } from '@/ui/confirm-dialog';
import { FormAlert } from '@/ui/form-alert';
import { useNotify } from '@/ui/notice';

import type { Earning } from '../../list/earning-model';
import { asApiError } from '../../list/earnings-query';

import { isStaleEarningError, useChangeEarningStatus, useDeleteEarning } from './api';
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
 * O erro de uma confirmação: se a receita mudou noutro lugar, o detalhe é recarregado e o diálogo
 * fecha com um aviso de erro; os demais ficam no `FormAlert` do diálogo.
 */
function useStaleErrorHandler(onClose: () => void) {
    const notify = useNotify();
    return (error: Error) => {
        if (!isStaleEarningError(error)) return;
        onClose();
        notify({ tone: 'erro', message: asApiError(error).userMessage });
    };
}

function alertMessage(error: Error | null): string | null {
    return error && !isStaleEarningError(error) ? asApiError(error).userMessage : null;
}

/**
 * **Desfazer recebimento** (spec 0014): confirma "O valor sai do saldo da conta." e envia
 * `{ status: 'OPEN' }`. Um erro da API fica no alerta, com o diálogo aberto, salvo o conflito de
 * status (`useStaleErrorHandler`).
 */
export function UndoReceiptDialog({ earning, onClose }: EarningDialogProps) {
    const notify = useNotify();
    const change = useChangeEarningStatus();
    const onError = useStaleErrorHandler(onClose);
    const confirm = () =>
        change.mutate(
            { id: earning.id, body: { status: 'OPEN' } },
            {
                onSuccess: () => {
                    onClose();
                    notify({ tone: 'sucesso', message: ACTION_NOTICES.desfazer });
                },
                onError,
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
    const onError = useStaleErrorHandler(onClose);
    const confirm = () =>
        remove.mutate(earning.id, {
            onSuccess: () => {
                notify({ tone: 'sucesso', message: 'Receita excluída.' });
                void navigate({ to: '/receitas' });
            },
            onError,
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
