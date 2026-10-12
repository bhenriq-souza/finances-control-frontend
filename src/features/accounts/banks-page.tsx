import { Link } from '@tanstack/react-router';
import { ArrowLeft, Landmark } from 'lucide-react';

import { useBanks, type Bank } from '@/api/queries/reference';
import { buttonVariants } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { StatusBadge } from '@/ui/status-badge';
import { DERIVED_BADGES } from '@/ui/status-labels';

import { ArchivedToggle, QueryContent, sortByText, visibleItems } from './list-parts';

const archivedBadge = (bank: Bank) =>
    bank.archivedAt ? <StatusBadge badge={DERIVED_BADGES.arquivado} /> : null;

const code = (bank: Bank) => <span className="font-mono text-codigo">{bank.febrabanCode}</span>;

const COLUMNS: readonly EntryColumn<Bank>[] = [
    { header: 'Código', cell: code },
    { header: 'Banco', cell: (bank) => bank.name },
    { header: 'Estado', cell: archivedBadge },
];

function BankCard({ bank }: { bank: Bank }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
                <span className="text-corpo-forte">{bank.name}</span>
                <span className="text-texto-apoio">{code(bank)}</span>
            </div>
            {archivedBadge(bank)}
        </div>
    );
}

export interface BanksPageProps {
    /** `?arquivados=1`. */
    showArchived: boolean;
    onShowArchivedChange: (showArchived: boolean) => void;
}

/** `/contas/bancos` (spec 0011): os bancos, em ordem de nome. */
export function BanksPage({ showArchived, onShowArchivedChange }: BanksPageProps) {
    const query = useBanks();
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <Link
                    to="/contas"
                    className={buttonVariants({ variant: 'link', className: 'self-start' })}
                >
                    <ArrowLeft aria-hidden="true" strokeWidth={1.75} />
                    Contas
                </Link>
                <h1 className="text-titulo-1">Bancos</h1>
            </div>
            <QueryContent query={query}>
                {(banks) => (
                    <div className="flex flex-col gap-3">
                        <ArchivedToggle
                            label="Mostrar arquivados"
                            checked={showArchived}
                            onChange={onShowArchivedChange}
                        />
                        <EntryList
                            items={sortByText(
                                visibleItems(banks, showArchived),
                                (bank) => bank.name,
                            )}
                            getKey={(bank) => bank.id}
                            caption="Bancos"
                            columns={COLUMNS}
                            renderCard={(bank) => <BankCard bank={bank} />}
                            empty={
                                <EmptyState
                                    variant="vazio"
                                    icon={Landmark}
                                    title="Nenhum banco."
                                    description="Os bancos cadastrados aparecem aqui."
                                />
                            }
                        />
                    </div>
                )}
            </QueryContent>
        </div>
    );
}
