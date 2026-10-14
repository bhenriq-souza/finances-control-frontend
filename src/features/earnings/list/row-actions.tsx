import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { useCan } from '@/api/permissions';
import { FormAlert } from '@/ui/form-alert';
import { useNotify } from '@/ui/notice';
import { RowMenu } from '@/ui/row-menu';

import { useChangeEarningStatus } from '../detail/actions/api';
import { DeleteEarningDialog, UndoReceiptDialog } from '../detail/actions/confirm-dialogs';
import { useLatchedOpen } from '../detail/actions/earning-actions';
import { menuItems } from '../detail/actions/menu-items';
import { ReceiveDialog } from '../detail/actions/receive-dialog';
import {
    ACTION_NOTICES,
    ACTION_TARGET,
    canDelete,
    menuActions,
    statusActions,
    type MenuAction,
} from '../detail/actions/transitions';
import { EarningFormDialog } from '../form/earning-form';

import type { Earning } from './earning-model';
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

/**
 * Os diálogos abertos: `{ receber: <id> }` etc. A lista os lê de `?receber=<id>`; o fluxo de caixa
 * (spec 0015) os traduz de `?acao=receber&receita=<id>`.
 */
export type EarningQuickParams = Partial<Record<RowDialog, string | undefined>>;

export interface RowDialogsProps {
    params: EarningQuickParams;
    onParamsChange: (next: EarningQuickParams) => void;
    onFail: (message: string) => void;
}

/** Os diálogos de ação abertos pelos parâmetros (na lista, `?receber=<id>`, `?editar=<id>` etc.). */
export function RowDialogs({ params, onParamsChange, onFail }: RowDialogsProps) {
    return (
        <>
            {ROW_DIALOGS.map((dialog) => {
                const id = params[dialog];
                return id ? (
                    <DialogHost
                        key={`${dialog}-${id}`}
                        dialog={dialog}
                        id={id}
                        onFail={onFail}
                        onClose={() => onParamsChange({ ...params, [dialog]: undefined })}
                    />
                ) : null;
            })}
        </>
    );
}

export interface EarningQuickActions {
    /** O menu da linha (`actions` do `EntryList`); `undefined` sem `entries.write`. */
    rowMenu: ((earning: Earning) => ReactNode) | undefined;
    /** O alerta de erro de uma transição sem diálogo (ou de uma receita que não pôde ser lida). */
    alert: ReactNode;
    /** Os diálogos abertos pelos parâmetros; `null` sem `entries.write`. */
    dialogs: ReactNode;
}

/**
 * As ações rápidas da lista de receitas (spec 0014, INV-0014-05): o menu da linha com as ações do
 * detalhe, as transições sem diálogo enviadas direto e os diálogos de **Receber**, **Editar**,
 * **Excluir** e **Desfazer recebimento** sobre a tela. Os diálogos abertos vêm de `params`,
 * independentes da rota: a lista usa `?receber=<id>`; o fluxo de caixa (spec 0015),
 * `?acao=receber&receita=<id>`. Só com `entries.write`.
 */
export function useEarningQuickActions(
    params: EarningQuickParams,
    onParamsChange: (next: EarningQuickParams) => void,
): EarningQuickActions {
    const canWrite = useCan('entries.write');
    const notify = useNotify();
    const change = useChangeEarningStatus();
    const [dialogError, setDialogError] = useState<string | null>(null);

    // Receber, Editar, Excluir e Desfazer recebimento abrem o diálogo sobre a lista; as demais
    // transições enviam direto (spec 0014, "Ações rápidas na lista").
    const runAction = (earning: Earning, action: MenuAction) => {
        setDialogError(null);
        if (isRowDialog(action)) {
            onParamsChange({ ...params, [action]: earning.id });
        } else {
            change.mutate(
                { id: earning.id, body: { status: ACTION_TARGET[action] } },
                { onSuccess: () => notify({ tone: 'sucesso', message: ACTION_NOTICES[action] }) },
            );
        }
    };
    const actionError = change.error ? asApiError(change.error).userMessage : dialogError;

    return {
        rowMenu: canWrite
            ? (earning) => (
                  <RowMenu
                      label={`Ações de ${earning.description}`}
                      items={menuItems(
                          menuActions(earning),
                          (action) => runAction(earning, action),
                          change.isPending,
                      )}
                  />
              )
            : undefined,
        alert: <FormAlert message={actionError} />,
        dialogs: canWrite && (
            <RowDialogs params={params} onParamsChange={onParamsChange} onFail={setDialogError} />
        ),
    };
}
