import { useNavigate, useSearch } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useCan } from '@/api/permissions';
import { Button } from '@/ui/components/ui/button';
import { FormAlert } from '@/ui/form-alert';
import { useNotify } from '@/ui/notice';

import type { Earning } from '../../list/earning-model';
import { asApiError } from '../../list/earnings-query';

import { useChangeEarningStatus } from './api';
import { DeleteEarningDialog, UndoReceiptDialog } from './confirm-dialogs';
import { ReceiveDialog } from './receive-dialog';
import {
    ACTION_LABELS,
    ACTION_NOTICES,
    ACTION_TARGET,
    canDelete,
    statusActions,
    type EarningAction,
} from './transitions';

/** Os parâmetros de busca do detalhe que abrem os diálogos destas ações. */
type DialogParam = 'receber' | 'excluir';

/** O diálogo que um parâmetro de busca abre e que a tela fecha tirando-o da URL. */
function useDialogParams() {
    const search: { receber?: unknown; excluir?: unknown } = useSearch({
        strict: false,
    });
    const navigate = useNavigate();
    const set = (param: DialogParam, open: boolean) =>
        void navigate({
            to: '.',
            search: (prev: Record<string, unknown>) => ({ ...prev, [param]: open ? 1 : undefined }),
            replace: !open,
        });
    return {
        receber: search.receber === 1,
        excluir: search.excluir === 1,
        open: (param: DialogParam) => set(param, true),
        close: (param: DialogParam) => set(param, false),
    };
}

/**
 * Um diálogo só abre se a ação existe no status atual; aberto, fica aberto mesmo que um
 * recarregamento mude o status, para o alerta do erro continuar à vista (spec 0014).
 */
function useLatchedOpen(requested: boolean, allowed: boolean): boolean {
    const [latched, setLatched] = useState(false);
    const open = requested && (allowed || latched);
    if (open !== latched) setLatched(open);
    return open;
}

export interface EarningActionsProps {
    earning: Earning;
}

/**
 * Ações de status e exclusão do detalhe de uma receita (spec 0014, "Detalhe e ações"), só com
 * `entries.write` (INV-0009-03): as da tabela de transições (INV-0014-02) e **Excluir** numa
 * receita não recebida. `?receber=1` e `?excluir=1` abrem os diálogos quando a ação existe no
 * status atual.
 */
export function EarningActions({ earning }: EarningActionsProps) {
    return useCan('entries.write') ? <WriteActions earning={earning} /> : null;
}

function WriteActions({ earning }: EarningActionsProps) {
    // O desfazer recebimento não tem parâmetro de busca na spec: o diálogo é estado local.
    const [undoOpen, setUndoOpen] = useState(false);
    const dialogs = useDialogParams();
    const notify = useNotify();
    const change = useChangeEarningStatus();

    const actions = statusActions(earning.status);
    const deletable = canDelete(earning);
    const receiveOpen = useLatchedOpen(dialogs.receber, actions.includes('receber'));
    const deleteOpen = useLatchedOpen(dialogs.excluir, deletable);

    const run = (action: EarningAction) => {
        if (action === 'receber') return dialogs.open('receber');
        if (action === 'desfazer') return setUndoOpen(true);
        change.mutate(
            { id: earning.id, body: { status: ACTION_TARGET[action] } },
            { onSuccess: () => notify({ tone: 'sucesso', message: ACTION_NOTICES[action] }) },
        );
    };

    return (
        <>
            <div
                role="group"
                aria-label="Ações"
                className="flex flex-col gap-3 md:flex-row md:flex-wrap"
            >
                {actions.map((action, index) => (
                    <Button
                        key={action}
                        variant={index === 0 ? 'default' : 'outline'}
                        disabled={change.isPending}
                        onClick={() => run(action)}
                    >
                        {ACTION_LABELS[action]}
                    </Button>
                ))}
                {deletable && (
                    <Button variant="outline" onClick={() => dialogs.open('excluir')}>
                        <Trash2 aria-hidden="true" />
                        Excluir
                    </Button>
                )}
            </div>
            <FormAlert message={change.error ? asApiError(change.error).userMessage : null} />

            {receiveOpen && (
                <ReceiveDialog earning={earning} onClose={() => dialogs.close('receber')} />
            )}
            {deleteOpen && (
                <DeleteEarningDialog earning={earning} onClose={() => dialogs.close('excluir')} />
            )}
            {undoOpen && <UndoReceiptDialog earning={earning} onClose={() => setUndoOpen(false)} />}
        </>
    );
}
