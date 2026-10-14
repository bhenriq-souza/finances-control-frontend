import { Link } from '@tanstack/react-router';
import { ArrowLeft, Landmark, Plus } from 'lucide-react';

import { useCan } from '@/api/permissions';
import { useBanks, type Bank } from '@/api/queries/reference';
import { Button, buttonVariants } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { StatusBadge } from '@/ui/status-badge';
import { DERIVED_BADGES } from '@/ui/status-labels';

import { type AccountsFormSearch, BankFormDialog, WriteActions } from './forms';
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
    /** `?novo=1` e `?editar=<id>`: o formulário aberto (só com `accounts.write`). */
    form?: AccountsFormSearch;
    onFormChange?: (form: AccountsFormSearch) => void;
}

/** `/contas/bancos` (spec 0011): os bancos, em ordem de nome. */
export function BanksPage({
    showArchived,
    onShowArchivedChange,
    form = {},
    onFormChange = () => undefined,
}: BanksPageProps) {
    const query = useBanks();
    const canWrite = useCan('accounts.write');
    const actions = (bank: Bank) => (
        <WriteActions
            kind="bank"
            item={bank}
            label={bank.name}
            onEdit={() => onFormChange({ editar: bank.id })}
        />
    );
    const columns = canWrite
        ? [...COLUMNS, { header: 'Ações', cell: actions, align: 'end' as const }]
        : COLUMNS;
    // Sem a permissão, `?novo` e `?editar` não têm efeito (INV-0011-01).
    const editing =
        canWrite && form.editar ? query.data?.find((b) => b.id === form.editar) : undefined;
    const creating = canWrite && form.novo === 1 && editing === undefined;
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-titulo-1">Bancos</h1>
                    {canWrite && (
                        <Button onClick={() => onFormChange({ novo: 1 })}>
                            <Plus aria-hidden="true" />
                            Novo banco
                        </Button>
                    )}
                </div>
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
                            columns={columns}
                            renderCard={(bank) => (
                                <div className="flex flex-col gap-3">
                                    <BankCard bank={bank} />
                                    {canWrite && actions(bank)}
                                </div>
                            )}
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
            {(creating || editing) && (
                <BankFormDialog
                    key={editing?.id ?? 'novo'}
                    bank={editing}
                    onClose={() => onFormChange({})}
                />
            )}
        </div>
    );
}
