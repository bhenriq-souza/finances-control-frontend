import { ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react';

import { useCan } from '@/api/permissions';
import { useAccountLookup } from '@/api/queries/lookups';
import { useBankAccounts } from '@/api/queries/reference';
import { addMonths, formatDate, formatMonth, monthOf, monthRange, today } from '@/shared/dates';
import type { Cents } from '@/shared/money';
import { Button } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { Money } from '@/ui/money';
import { SelectField } from '@/ui/select-field';
import { EntryListSkeleton } from '@/ui/skeleton';
import { StatusBadge } from '@/ui/status-badge';
import { bankTransferBadge } from '@/ui/status-labels';

import { type BankTransfer, useTransfers } from './api';
import type { TransfersSearch } from './search';
import { errorMessageOf } from './transfer-errors';
import { TransferFormDialog } from './transfer-form';

export interface TransfersPageProps {
    search: TransfersSearch;
    /** Atualiza os parâmetros de busca da rota (os não citados ficam como estão). */
    onSearchChange: (next: Partial<TransfersSearch>) => void;
}

const STATUS_OPTIONS = [
    { value: 'SCHEDULED', label: 'Agendadas' },
    { value: 'COMPLETED', label: 'Concluídas' },
];

/**
 * O valor da transferência (INV-0018-01): sempre no tom neutro; sem sinal, a não ser no filtro por
 * conta, quando ganha `−` se sai da conta e `+` se entra.
 */
export function TransferAmount({
    transfer,
    account,
}: {
    transfer: BankTransfer;
    account?: string;
}) {
    const cents = transfer.amountCents as Cents;
    if (account === transfer.fromBankAccountId) {
        return <Money cents={-cents as Cents} sign="always" tone="neutral" />;
    }
    if (account === transfer.toBankAccountId) {
        return <Money cents={cents} sign="always" tone="neutral" />;
    }
    return <Money cents={cents} sign="never" tone="neutral" />;
}

/** `/transferencias` (spec 0018, "Lista"). */
export function TransfersPage({ search, onSearchChange }: TransfersPageProps) {
    const canWrite = useCan('entries.write');
    const accounts = useBankAccounts();
    const lookup = useAccountLookup();
    const month = search.mes ?? monthOf(today());
    const transfers = useTransfers({
        ...monthRange(month),
        status: search.status,
        bankAccountId: search.conta,
    });

    const route = (transfer: BankTransfer) =>
        `${lookup.label(transfer.fromBankAccountId)} → ${lookup.label(transfer.toBankAccountId)}`;
    const amount = (transfer: BankTransfer) => (
        <TransferAmount transfer={transfer} account={search.conta} />
    );

    const columns: readonly EntryColumn<BankTransfer>[] = [
        { header: 'Descrição', cell: (transfer) => transfer.description },
        { header: 'Data', cell: (transfer) => formatDate(transfer.occurredOn, 'curta') },
        { header: 'Origem → Destino', cell: route },
        {
            header: 'Status',
            cell: (transfer) => <StatusBadge badge={bankTransferBadge(transfer)} />,
        },
        { header: 'Valor', cell: amount, align: 'end' },
    ];

    const create = () => onSearchChange({ novo: 1 });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-titulo-1">Transferências</h1>
                {canWrite && <Button onClick={create}>Nova transferência</Button>}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        aria-label="Mês anterior"
                        onClick={() => onSearchChange({ mes: addMonths(month, -1) })}
                    >
                        <ChevronLeft aria-hidden="true" />
                    </Button>
                    <p aria-live="polite" className="min-w-40 text-center text-corpo-forte">
                        {formatMonth(month)}
                    </p>
                    <Button
                        variant="ghost"
                        aria-label="Próximo mês"
                        onClick={() => onSearchChange({ mes: addMonths(month, 1) })}
                    >
                        <ChevronRight aria-hidden="true" />
                    </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 md:flex md:flex-1 md:justify-end">
                    <SelectField
                        label="Situação"
                        placeholder="Todas"
                        options={STATUS_OPTIONS}
                        value={search.status ?? ''}
                        onChange={(event) =>
                            onSearchChange({
                                status: (event.target.value ||
                                    undefined) as TransfersSearch['status'],
                            })
                        }
                    />
                    <SelectField
                        label="Conta"
                        placeholder="Todas"
                        options={(accounts.data ?? []).map((account) => ({
                            value: account.id,
                            label: account.description,
                        }))}
                        value={search.conta ?? ''}
                        onChange={(event) =>
                            onSearchChange({ conta: event.target.value || undefined })
                        }
                    />
                </div>
            </div>

            {transfers.isError ? (
                <EmptyState
                    variant="erro"
                    error={{ userMessage: errorMessageOf(transfers.error) }}
                    onRetry={() => void transfers.refetch()}
                />
            ) : !transfers.data ? (
                <EntryListSkeleton />
            ) : (
                <EntryList
                    items={transfers.data}
                    getKey={(transfer) => transfer.id}
                    caption={`Transferências de ${formatMonth(month)}`}
                    columns={columns}
                    href={(transfer) => `/transferencias/${transfer.id}`}
                    renderCard={(transfer) => (
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-col gap-1">
                                <span className="text-corpo-forte">{transfer.description}</span>
                                <span className="text-pequeno text-texto-apoio">
                                    {route(transfer)}
                                </span>
                                <span className="text-pequeno text-texto-apoio">
                                    {formatDate(transfer.occurredOn, 'curta')}
                                </span>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                {amount(transfer)}
                                <StatusBadge badge={bankTransferBadge(transfer)} />
                            </div>
                        </div>
                    )}
                    empty={
                        <EmptyState
                            variant="vazio"
                            icon={ArrowLeftRight}
                            title="Nenhuma transferência neste mês."
                            description="As transferências entre as suas contas aparecem aqui."
                        />
                    }
                />
            )}

            {canWrite && search.novo === 1 && (
                <TransferFormDialog
                    open
                    onOpenChange={(open) => {
                        if (!open) onSearchChange({ novo: undefined });
                    }}
                />
            )}
        </div>
    );
}
