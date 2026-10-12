import { Link } from '@tanstack/react-router';
import { Landmark } from 'lucide-react';

import { useBankAccounts, type BankAccount } from '@/api/queries/reference';
import type { Cents } from '@/shared/money';
import { buttonVariants } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { Money } from '@/ui/money';
import { StatusBadge } from '@/ui/status-badge';
import { DERIVED_BADGES } from '@/ui/status-labels';

import {
    ACCOUNT_TYPE_LABELS,
    ArchivedToggle,
    QueryContent,
    sortByText,
    visibleItems,
} from './list-parts';

/** Soma de `currentBalanceCents` das contas ativas: a única conta que o cliente faz (INV-0011-03). */
export function activeBalanceCents(accounts: readonly BankAccount[]): Cents {
    return accounts
        .filter((account) => account.archivedAt === null)
        .reduce((total, account) => total + account.currentBalanceCents, 0);
}

const archivedBadge = (account: BankAccount) =>
    account.archivedAt ? <StatusBadge badge={DERIVED_BADGES.arquivado} /> : null;

const COLUMNS: readonly EntryColumn<BankAccount>[] = [
    {
        header: 'Conta',
        cell: (account) => (
            <span className="flex flex-col">
                <span className="text-corpo-forte">{account.description}</span>
                <span className="text-pequeno text-texto-apoio">{account.bank.name}</span>
            </span>
        ),
    },
    { header: 'Tipo', cell: (account) => ACCOUNT_TYPE_LABELS[account.type] },
    {
        header: 'Número',
        cell: (account) => <span className="font-mono text-codigo">{account.accountNumber}</span>,
        hideBelow: 'lg',
    },
    {
        header: 'Cheque especial',
        cell: (account) =>
            account.overdraftLimitCents > 0 ? (
                <Money cents={account.overdraftLimitCents} size="valor-pequeno" />
            ) : null,
        align: 'end',
        hideBelow: 'lg',
    },
    {
        header: 'Saldo',
        cell: (account) => <Money cents={account.currentBalanceCents} sign="auto" tone="neutral" />,
        align: 'end',
    },
    { header: 'Estado', cell: archivedBadge },
];

function AccountCard({ account }: { account: BankAccount }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
                <span className="text-corpo-forte">{account.description}</span>
                <span className="text-pequeno text-texto-apoio">
                    {account.bank.name} · {ACCOUNT_TYPE_LABELS[account.type]}
                </span>
                {archivedBadge(account)}
            </div>
            <Money cents={account.currentBalanceCents} sign="auto" tone="neutral" />
        </div>
    );
}

export interface BankAccountsPageProps {
    /** `?arquivadas=1`. */
    showArchived: boolean;
    onShowArchivedChange: (showArchived: boolean) => void;
}

/** `/contas` (spec 0011): o saldo em contas e a lista das contas bancárias, em ordem de descrição. */
export function BankAccountsPage({ showArchived, onShowArchivedChange }: BankAccountsPageProps) {
    const query = useBankAccounts();
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-titulo-1">Contas</h1>
                <Link to="/contas/bancos" className={buttonVariants({ variant: 'outline' })}>
                    <Landmark aria-hidden="true" strokeWidth={1.75} />
                    Bancos
                </Link>
            </div>
            <QueryContent query={query}>
                {(accounts) => (
                    <>
                        <section
                            aria-labelledby="saldo-em-contas"
                            className="flex flex-col gap-1 rounded-md border border-linha bg-superficie p-4 md:p-6"
                        >
                            <h2 id="saldo-em-contas" className="text-rotulo text-texto-apoio">
                                Saldo em contas
                            </h2>
                            <Money
                                cents={activeBalanceCents(accounts)}
                                size="valor-destaque"
                                sign="auto"
                                tone="neutral"
                            />
                        </section>
                        <div className="flex flex-col gap-3">
                            <ArchivedToggle
                                label="Mostrar arquivadas"
                                checked={showArchived}
                                onChange={onShowArchivedChange}
                            />
                            <EntryList
                                items={sortByText(
                                    visibleItems(accounts, showArchived),
                                    (account) => account.description,
                                )}
                                getKey={(account) => account.id}
                                caption="Contas bancárias"
                                columns={COLUMNS}
                                renderCard={(account) => <AccountCard account={account} />}
                                empty={
                                    <EmptyState
                                        variant="vazio"
                                        icon={Landmark}
                                        title="Nenhuma conta bancária."
                                        description="As contas cadastradas aparecem aqui."
                                    />
                                }
                            />
                        </div>
                    </>
                )}
            </QueryContent>
        </div>
    );
}
