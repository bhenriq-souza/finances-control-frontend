import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { ApiError } from '@/api/errors/api-error';
import { useCan } from '@/api/permissions';
import { useAccountLookup } from '@/api/queries/lookups';
import { formatDate, today } from '@/shared/dates';
import type { Cents } from '@/shared/money';
import { Alert } from '@/ui/components/ui/alert';
import { Button } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { Money } from '@/ui/money';
import { Skeleton } from '@/ui/skeleton';
import { StatusBadge } from '@/ui/status-badge';
import { bankTransferBadge } from '@/ui/status-labels';

import { type BankTransfer, useTransfer } from './api';
import type { TransferDetailSearch } from './search';
import {
    CompleteTransferDialog,
    DeleteTransferDialog,
    UndoTransferDialog,
} from './transfer-actions';
import { errorMessageOf } from './transfer-errors';
import { TransferFormDialog } from './transfer-form';

const LIST = '/transferencias';

export interface TransferDetailPageProps {
    transferId: string;
    search: TransferDetailSearch;
    /** Atualiza os parâmetros de busca da rota (os não citados ficam como estão). */
    onSearchChange: (next: Partial<TransferDetailSearch>) => void;
    /** Depois de excluir: volta para a lista. */
    onDeleted: () => void;
}

/** `/transferencias/$transferenciaId` (spec 0018, "Detalhe e ações"). */
export function TransferDetailPage({
    transferId,
    search,
    onSearchChange,
    onDeleted,
}: TransferDetailPageProps) {
    const query = useTransfer(transferId);

    // Com dado, ele vale mesmo que um recarregamento falhe: assim a exclusão termina na tela.
    if (query.data) {
        return (
            <TransferDetail
                transfer={query.data}
                search={search}
                onSearchChange={onSearchChange}
                onDeleted={onDeleted}
            />
        );
    }
    if (query.isError) {
        const notFound =
            query.error instanceof ApiError && query.error.code === 'BANK_TRANSFER_NOT_FOUND';
        return notFound ? (
            <EmptyState variant="nao-encontrado" backTo={LIST} />
        ) : (
            <EmptyState
                variant="erro"
                error={{ userMessage: errorMessageOf(query.error) }}
                onRetry={() => void query.refetch()}
            />
        );
    }
    return (
        <div role="status" aria-label="Carregando" className="flex flex-col gap-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
        </div>
    );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <dt className="text-rotulo text-texto-apoio">{label}</dt>
            <dd className="text-corpo text-texto">{children}</dd>
        </div>
    );
}

function TransferDetail({
    transfer,
    search,
    onSearchChange,
    onDeleted,
}: Omit<TransferDetailPageProps, 'transferId'> & { transfer: BankTransfer }) {
    const canWrite = useCan('entries.write');
    const lookup = useAccountLookup();
    const [undoOpen, setUndoOpen] = useState(false);
    const scheduled = transfer.status === 'SCHEDULED';
    const pastDue = scheduled && transfer.occurredOn < today();

    return (
        <div className="flex flex-col gap-4">
            <Link
                to={LIST}
                className="inline-flex min-h-11 items-center gap-1 self-start rounded-md text-corpo text-texto-apoio outline-none hover:text-texto focus-visible:ring-2 focus-visible:ring-foco"
            >
                <ChevronLeft aria-hidden="true" className="size-4" />
                Transferências
            </Link>

            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="text-titulo-1">{transfer.description}</h1>
                    <div className="flex flex-wrap items-center gap-3">
                        <StatusBadge badge={bankTransferBadge(transfer)} />
                        <Money
                            cents={transfer.amountCents as Cents}
                            sign="never"
                            tone="neutral"
                            size="valor-destaque"
                        />
                    </div>
                </div>
                {canWrite && (
                    <div className="flex flex-wrap gap-3">
                        {scheduled ? (
                            <>
                                <Button onClick={() => onSearchChange({ concluir: 1 })}>
                                    Concluir
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => onSearchChange({ editar: 1 })}
                                >
                                    Editar
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => onSearchChange({ excluir: 1 })}
                                >
                                    Excluir
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => setUndoOpen(true)}>
                                    Desfazer
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => onSearchChange({ editar: 1 })}
                                >
                                    Editar
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {pastDue && <Alert variant="atencao">Agendada para uma data que já passou.</Alert>}

            <dl className="grid gap-4 rounded-md border border-linha bg-superficie p-4 md:grid-cols-2">
                <Item label="De">{lookup.label(transfer.fromBankAccountId)}</Item>
                <Item label="Para">{lookup.label(transfer.toBankAccountId)}</Item>
                <Item label="Data">{formatDate(transfer.occurredOn, 'longa')}</Item>
                {transfer.completedOn && (
                    <Item label="Concluída em">{formatDate(transfer.completedOn, 'longa')}</Item>
                )}
                {transfer.notes && <Item label="Observações">{transfer.notes}</Item>}
            </dl>

            {canWrite && search.editar === 1 && (
                <TransferFormDialog
                    open
                    transfer={transfer}
                    onOpenChange={(open) => {
                        if (!open) onSearchChange({ editar: undefined });
                    }}
                />
            )}
            {/* INV-0018-02: concluir e excluir só existem na agendada. */}
            {canWrite && scheduled && search.concluir === 1 && (
                <CompleteTransferDialog
                    open
                    transfer={transfer}
                    onOpenChange={(open) => {
                        if (!open) onSearchChange({ concluir: undefined });
                    }}
                />
            )}
            {canWrite && scheduled && (
                <DeleteTransferDialog
                    open={search.excluir === 1}
                    transfer={transfer}
                    onOpenChange={(open) => onSearchChange({ excluir: open ? 1 : undefined })}
                    onDeleted={onDeleted}
                />
            )}
            {/* Montado sempre: desfazer torna a transferência agendada antes de o aviso sair. */}
            {canWrite && (
                <UndoTransferDialog
                    open={undoOpen}
                    transfer={transfer}
                    onOpenChange={setUndoOpen}
                />
            )}
        </div>
    );
}
