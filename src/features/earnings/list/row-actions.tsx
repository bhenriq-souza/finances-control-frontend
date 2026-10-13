import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { DeleteEarningDialog, UndoReceiptDialog } from '../detail/actions/confirm-dialogs';
import { useLatchedOpen } from '../detail/actions/earning-actions';
import { ReceiveDialog } from '../detail/actions/receive-dialog';
import { canDelete, statusActions } from '../detail/actions/transitions';
import { EarningFormDialog } from '../form/earning-form';

import type { Earning } from './earning-model';
import type { EarningListSearch } from './earning-search';
import { asApiError, earningDetailQuery } from './earnings-query';

/** Os parâmetros de busca da lista que abrem um diálogo de ação, cada um com o id da receita. */
export const ROW_DIALOGS = ['receber', 'editar', 'excluir', 'desfazer'] as const;
export type RowDialog = (typeof ROW_DIALOGS)[number];

export function isRowDialog(action: string): action is RowDialog {
    return (ROW_DIALOGS as readonly string[]).includes(action);
}

/** A ação existe para a receita no status atual (INV-0014-05: as mesmas do detalhe). */
function allowed(dialog: RowDialog, earning: Earning): boolean {
    switch (dialog) {
        case 'receber':
            return statusActions(earning.status).includes('receber');
        case 'desfazer':
            return earning.status === 'RECEIVED';
        case 'excluir':
            return canDelete(earning);
        case 'editar':
            return true;
    }
}

interface HostProps {
    dialog: RowDialog;
    id: string;
    onClose: () => void;
    /** A receita não pôde ser lida: a mensagem do catálogo vai para o alerta da lista. */
    onFail: (message: string) => void;
}

/**
 * Lê a receita por `GET /earnings/{id}` e abre sobre a lista o mesmo diálogo do detalhe. Um
 * diálogo aberto continua aberto se o status mudar (o alerta do erro fica à vista); um que a
 * ação não permite, ou uma receita que não existe, é descartado da URL.
 */
function DialogHost({ dialog, id, onClose, onFail }: HostProps) {
    const query = useQuery(earningDetailQuery(id));
    const earning = query.data;
    const open = useLatchedOpen(true, earning ? allowed(dialog, earning) : false);
    const failed = query.isError ? asApiError(query.error).userMessage : null;

    useEffect(() => {
        if (failed) {
            onFail(failed);
            onClose();
        } else if (earning && !open) {
            onClose();
        }
        // `onClose`/`onFail` mudam a cada render da lista; só o resultado da consulta importa.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [failed, earning, open]);

    if (!earning || !open) return null;
    switch (dialog) {
        case 'receber':
            return <ReceiveDialog earning={earning} onClose={onClose} />;
        case 'desfazer':
            return <UndoReceiptDialog earning={earning} onClose={onClose} />;
        case 'excluir':
            return <DeleteEarningDialog earning={earning} onClose={onClose} onDeleted={onClose} />;
        case 'editar':
            return (
                <EarningFormDialog
                    open
                    earning={earning}
                    onOpenChange={(next) => {
                        if (!next) onClose();
                    }}
                />
            );
    }
}

export interface RowDialogsProps {
    search: EarningListSearch;
    onSearchChange: (search: EarningListSearch) => void;
    onFail: (message: string) => void;
}

/** Os diálogos de ação abertos por `?receber=<id>`, `?editar=<id>`, `?excluir=<id>`, `?desfazer=<id>`. */
export function RowDialogs({ search, onSearchChange, onFail }: RowDialogsProps) {
    return (
        <>
            {ROW_DIALOGS.map((dialog) => {
                const id = search[dialog];
                return id ? (
                    <DialogHost
                        key={`${dialog}-${id}`}
                        dialog={dialog}
                        id={id}
                        onFail={onFail}
                        onClose={() => onSearchChange({ ...search, [dialog]: undefined })}
                    />
                ) : null;
            })}
        </>
    );
}
