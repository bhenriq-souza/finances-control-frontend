import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, ReceiptText } from 'lucide-react';

import { ApiError } from '@/api/errors/api-error';
import { useAccountLookup, useCardLookup } from '@/api/queries/lookups';
import { useBankAccounts, type BankAccount } from '@/api/queries/reference';
import { addMonths, formatDate, formatMonth } from '@/shared/dates';
import { Button, buttonVariants } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { Money } from '@/ui/money';
import { EntryListSkeleton, Skeleton } from '@/ui/skeleton';
import { StatusBadge } from '@/ui/status-badge';
import { DERIVED_BADGES } from '@/ui/status-labels';

import { MovementDescription, movementHref, movementTexts } from './movement-parts';
import {
    accountMovementsQuery,
    type AccountMovement,
    type AccountMovementsReport,
} from './queries';
import { statementMonth, type AccountStatementSearch } from './search';

export interface AccountStatementPageProps {
    bankAccountId: string;
    search: AccountStatementSearch;
    onSearchChange: (search: AccountStatementSearch) => void;
}

function Header({ bankAccountId }: { bankAccountId: string }) {
    const { data } = useBankAccounts();
    const account = data?.find((candidate) => candidate.id === bankAccountId);
    return (
        <div className="flex flex-col gap-2">
            <Link
                to="/contas"
                className={buttonVariants({ variant: 'ghost', className: 'self-start' })}
            >
                <ChevronLeft aria-hidden="true" strokeWidth={1.75} />
                Contas
            </Link>
            <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-titulo-1">{account?.description ?? 'Extrato'}</h1>
                    {account?.archivedAt && <StatusBadge badge={DERIVED_BADGES.arquivado} />}
                </div>
                {account && (
                    <p className="text-pequeno text-texto-apoio">
                        {account.bank.name} · {ACCOUNT_TYPES[account.type]}
                    </p>
                )}
            </div>
        </div>
    );
}

const ACCOUNT_TYPES: Readonly<Record<BankAccount['type'], string>> = {
    CHECKING: 'Corrente',
    SAVINGS: 'Poupança',
    INVESTMENT: 'Investimento',
};

function MonthNavigation({
    search,
    onSearchChange,
}: Omit<AccountStatementPageProps, 'bankAccountId'>) {
    const month = statementMonth(search);
    const go = (n: number) => onSearchChange({ mes: addMonths(month, n) });
    return (
        <div className="flex items-center gap-2">
            <Button variant="ghost" aria-label="Mês anterior" onClick={() => go(-1)}>
                <ChevronLeft aria-hidden="true" className="size-5" />
            </Button>
            <h2 className="min-w-44 text-center text-titulo-3" aria-live="polite">
                {formatMonth(month)}
            </h2>
            <Button variant="ghost" aria-label="Próximo mês" onClick={() => go(1)}>
                <ChevronRight aria-hidden="true" className="size-5" />
            </Button>
        </div>
    );
}

function Balance({ label, cents }: { label: string; cents: number }) {
    return (
        <div className="flex items-baseline justify-between gap-3 rounded-md border border-linha bg-superficie p-4">
            <span className="text-rotulo text-texto-apoio">{label}</span>
            <Money cents={cents} size="valor-destaque" sign="auto" tone="neutral" />
        </div>
    );
}

function Statement({ report }: { report: AccountMovementsReport }) {
    const accounts = useAccountLookup();
    const cards = useCardLookup();
    const texts = (movement: AccountMovement) => movementTexts(movement, accounts, cards);
    const description = (movement: AccountMovement) => (
        <MovementDescription kind={movement.kind} {...texts(movement)} />
    );
    const columns: readonly EntryColumn<AccountMovement>[] = [
        { header: 'Data', cell: (movement) => formatDate(movement.date, 'relativa') },
        { header: 'Descrição', cell: description },
        {
            header: 'Valor',
            cell: (movement) => <Money cents={movement.amountCents} sign="always" tone="auto" />,
            align: 'end',
        },
        {
            header: 'Saldo',
            cell: (movement) => (
                <Money cents={movement.balanceAfterCents} sign="auto" tone="neutral" />
            ),
            align: 'end',
        },
    ];
    return (
        <div className="flex flex-col gap-4">
            <Balance label="Saldo inicial" cents={report.openingBalanceCents} />
            <EntryList
                items={report.movements}
                getKey={(movement) => `${movement.kind}:${movement.sourceId}`}
                caption="Movimentos da conta"
                columns={columns}
                href={movementHref}
                renderCard={(movement) => (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                            {description(movement)}
                            <Money cents={movement.amountCents} sign="always" tone="auto" />
                        </div>
                        <div className="flex items-baseline justify-between gap-3 text-pequeno text-texto-apoio">
                            <span>{formatDate(movement.date, 'relativa')}</span>
                            <span className="flex items-baseline gap-1">
                                Saldo
                                <Money
                                    cents={movement.balanceAfterCents}
                                    size="valor-pequeno"
                                    sign="auto"
                                    tone="neutral"
                                />
                            </span>
                        </div>
                    </div>
                )}
                empty={
                    <EmptyState
                        variant="vazio"
                        icon={ReceiptText}
                        title="Nenhum movimento neste mês."
                    />
                }
            />
            <Balance label="Saldo final" cents={report.closingBalanceCents} />
        </div>
    );
}

/**
 * Extrato de uma conta (`/contas/$contaId`, spec 0015): os movimentos do mês e os saldos como a
 * API os entrega; nada é somado no cliente (INV-0015-05).
 */
export function AccountStatementPage({
    bankAccountId,
    search,
    onSearchChange,
}: AccountStatementPageProps) {
    const query = useQuery(accountMovementsQuery(bankAccountId, statementMonth(search)));
    const error =
        query.error instanceof ApiError
            ? query.error
            : query.error
              ? new ApiError({ status: 0, code: 'UNEXPECTED_RESPONSE' })
              : null;

    let content;
    if (error?.code === 'BANK_ACCOUNT_NOT_FOUND') {
        content = (
            <EmptyState variant="nao-encontrado" backTo="/contas" backLabel="Voltar para Contas" />
        );
    } else if (error) {
        content = <EmptyState variant="erro" error={error} onRetry={() => void query.refetch()} />;
    } else if (!query.data) {
        content = (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-16 w-full" />
                <EntryListSkeleton />
            </div>
        );
    } else {
        content = <Statement report={query.data} />;
    }

    return (
        <div className="flex flex-col gap-6">
            <Header bankAccountId={bankAccountId} />
            {error?.code !== 'BANK_ACCOUNT_NOT_FOUND' && (
                <MonthNavigation search={search} onSearchChange={onSearchChange} />
            )}
            {content}
        </div>
    );
}
