import { Archive, ArchiveRestore } from 'lucide-react';

import { ApiError } from '@/api/errors/api-error';
import { CLIENT_ERROR_MESSAGES } from '@/api/errors/catalog';
import { Button } from '@/ui/components/ui/button';
import { useNotify } from '@/ui/notice';

import { type ArchivableKind, useArchive } from './api';

/** O aviso de sucesso de cada cadastro (spec 0011: "Conta arquivada." etc.). */
const MESSAGES: Readonly<Record<ArchivableKind, { archived: string; unarchived: string }>> = {
    bank: { archived: 'Banco arquivado.', unarchived: 'Banco desarquivado.' },
    'bank-account': { archived: 'Conta arquivada.', unarchived: 'Conta desarquivada.' },
    'credit-card': { archived: 'Cartão arquivado.', unarchived: 'Cartão desarquivado.' },
};

/** A mensagem do catálogo de um erro da API (INV-0000-06). */
const userMessageOf = (error: unknown) =>
    error instanceof ApiError ? error.userMessage : CLIENT_ERROR_MESSAGES.UNEXPECTED_RESPONSE;

export interface ArchiveButtonProps {
    kind: ArchivableKind;
    item: { id: string; archivedAt: string | null };
    /** Nome do item no rótulo acessível ("Arquivar Conta corrente"). */
    label: string;
}

/**
 * **Arquivar** ou **Desarquivar** (`POST`/`DELETE /…/{id}/archive`), sem confirmação: é reversível
 * e idempotente (spec 0011). O resultado vai para um `Notice`; a lista muda pela invalidação.
 */
export function ArchiveButton({ kind, item, label }: ArchiveButtonProps) {
    const notify = useNotify();
    const archive = useArchive();
    const archived = item.archivedAt !== null;
    const action = archived ? 'Desarquivar' : 'Arquivar';

    function toggle() {
        archive.mutate(
            { kind, id: item.id, archive: !archived },
            {
                onSuccess: () =>
                    notify({
                        tone: 'sucesso',
                        message: archived ? MESSAGES[kind].unarchived : MESSAGES[kind].archived,
                    }),
                onError: (error) => notify({ tone: 'erro', message: userMessageOf(error) }),
            },
        );
    }

    return (
        <Button
            variant="outline"
            aria-label={`${action} ${label}`}
            disabled={archive.isPending}
            onClick={toggle}
        >
            {archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
            {action}
        </Button>
    );
}
