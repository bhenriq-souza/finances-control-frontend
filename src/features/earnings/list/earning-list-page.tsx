import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Plus, Tags } from 'lucide-react';
import { useState } from 'react';

import { useCan } from '@/api/permissions';
import { useAccountLookup } from '@/api/queries/lookups';
import { formatDate } from '@/shared/dates';
import { Button, buttonVariants } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { FormAlert } from '@/ui/form-alert';
import { Money } from '@/ui/money';
import { useNotify } from '@/ui/notice';
import { RowMenu } from '@/ui/row-menu';
import { EntryListSkeleton } from '@/ui/skeleton';
import { StatusBadge } from '@/ui/status-badge';
import { earningBadge } from '@/ui/status-labels';

import { useChangeEarningStatus } from '../detail/actions/api';
import { menuItems } from '../detail/actions/menu-items';
import {
    ACTION_NOTICES,
    ACTION_TARGET,
    menuActions,
    type MenuAction,
} from '../detail/actions/transitions';
import { EarningFormDialog } from '../form/earning-form';

import { EarningFilters, MonthNavigation } from './earning-filters';
import { earningSupport, type Earning } from './earning-model';
import { earningListParams, type EarningListSearch } from './earning-search';
import {
    asApiError,
    earningsListQuery,
    sortEarnings,
    summarizeEarnings,
    type EarningSummary,
} from './earnings-query';
import { isRowDialog, RowDialogs } from './row-actions';

export interface EarningListPageProps {
    search: EarningListSearch;
    /** Troca os parâmetros de busca da rota (filtros, mês, `novo`). */
    onSearchChange: (search: EarningListSearch) => void;
}

/** Valor de receita: sempre com o sinal `+` (INV-0014-01). */
function EarningAmount({ cents, size }: { cents: number; size?: 'valor-destaque' }) {
    return <Money cents={cents} sign="always" tone="auto" size={size} />;
}

function Description({ earning }: { earning: Earning }) {
    const support = earningSupport(earning);
    return (
        <span className="flex flex-col">
            <span>{earning.description}</span>
            {support && <span className="text-pequeno text-texto-apoio">{support}</span>}
        </span>
    );
}

function plural(count: number, singular: string, pluralForm: string) {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}

function Summary({ summary }: { summary: EarningSummary }) {
    return (
        <section
            aria-label="Resumo"
            className="flex flex-col gap-1 rounded-md border border-linha bg-superficie p-4"
        >
            <span className="text-rotulo text-texto-apoio">Total</span>
            <EarningAmount cents={summary.totalCents} size="valor-destaque" />
            <p className="text-pequeno text-texto-apoio">
                {plural(summary.received, 'recebida', 'recebidas')} ·{' '}
                {plural(summary.pending, 'pendente', 'pendentes')} ·{' '}
                {plural(summary.overdue, 'atrasada', 'atrasadas')}
            </p>
        </section>
    );
}

function hasFilters(search: EarningListSearch) {
    return Boolean(search.status || search.tipo || search.conta || search.natureza || search.grupo);
}

/**
 * Lista de receitas do mês (spec 0014, "Lista"): navegação de mês, filtros na URL, resumo e o
 * `EntryList`. **Nova receita** e **Tipos de receita** só com `entries.write`.
 */
export function EarningListPage({ search, onSearchChange }: EarningListPageProps) {
    const canWrite = useCan('entries.write');
    const accounts = useAccountLookup();
    const query = useQuery(earningsListQuery(earningListParams(search)));
    const earnings = query.data ? sortEarnings(query.data) : undefined;
    const notify = useNotify();
    const change = useChangeEarningStatus();
    const [dialogError, setDialogError] = useState<string | null>(null);

    // Receber, Editar, Excluir e Desfazer recebimento abrem o diálogo sobre a lista; as demais
    // transições enviam direto (spec 0014, "Ações rápidas na lista").
    const runAction = (earning: Earning, action: MenuAction) => {
        setDialogError(null);
        if (isRowDialog(action)) {
            onSearchChange({ ...search, [action]: earning.id });
        } else {
            change.mutate(
                { id: earning.id, body: { status: ACTION_TARGET[action] } },
                { onSuccess: () => notify({ tone: 'sucesso', message: ACTION_NOTICES[action] }) },
            );
        }
    };
    const actionError = change.error ? asApiError(change.error).userMessage : dialogError;

    const columns: readonly EntryColumn<Earning>[] = [
        { header: 'Data', cell: (earning) => formatDate(earning.occurredOn, 'relativa') },
        { header: 'Descrição', cell: (earning) => <Description earning={earning} /> },
        { header: 'Tipo', cell: (earning) => earning.earningType.name, hideBelow: 'lg' },
        { header: 'Conta', cell: (earning) => accounts.label(earning.bankAccountId) },
        { header: 'Status', cell: (earning) => <StatusBadge badge={earningBadge(earning)} /> },
        {
            header: 'Valor',
            cell: (earning) => <EarningAmount cents={earning.amountCents} />,
            align: 'end',
        },
    ];

    const renderCard = (earning: Earning) => (
        <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
                <span className="flex flex-col">
                    <span className="text-corpo-forte">{earning.description}</span>
                    {earningSupport(earning) && (
                        <span className="text-pequeno text-texto-apoio">
                            {earningSupport(earning)}
                        </span>
                    )}
                </span>
                <EarningAmount cents={earning.amountCents} />
            </div>
            <div className="flex items-center justify-between gap-3">
                <span className="text-pequeno text-texto-apoio">
                    {formatDate(earning.occurredOn, 'relativa')} ·{' '}
                    {accounts.label(earning.bankAccountId)}
                </span>
                <StatusBadge badge={earningBadge(earning)} />
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-4 md:gap-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-titulo-1">Receitas</h1>
                {canWrite && (
                    <div className="flex items-center gap-2">
                        <Link
                            to="/receitas/tipos"
                            className={buttonVariants({ variant: 'outline' })}
                        >
                            <Tags aria-hidden="true" />
                            Tipos de receita
                        </Link>
                        <Button
                            onClick={() => onSearchChange({ ...search, novo: 1 })}
                            className="fixed right-4 bottom-20 z-10 shadow-[var(--ft-sombra-flutuante)] md:static md:shadow-none"
                        >
                            <Plus aria-hidden="true" />
                            Nova receita
                        </Button>
                    </div>
                )}
            </header>
            {!search.grupo && <MonthNavigation search={search} onSearchChange={onSearchChange} />}
            <EarningFilters search={search} onSearchChange={onSearchChange} />
            {query.isError ? (
                <EmptyState
                    variant="erro"
                    error={asApiError(query.error)}
                    onRetry={() => void query.refetch()}
                />
            ) : earnings === undefined ? (
                <EntryListSkeleton />
            ) : (
                <>
                    <FormAlert message={actionError} />
                    <Summary summary={summarizeEarnings(earnings)} />
                    <EntryList
                        items={earnings}
                        getKey={(earning) => earning.id}
                        caption="Receitas"
                        columns={columns}
                        renderCard={renderCard}
                        href={(earning) => `/receitas/${earning.id}`}
                        actions={
                            canWrite
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
                                : undefined
                        }
                        empty={
                            hasFilters(search) ? (
                                <EmptyState
                                    variant="vazio"
                                    title="Nenhuma receita com estes filtros."
                                    description="Remova um filtro para ver mais receitas."
                                />
                            ) : (
                                <EmptyState
                                    variant="vazio"
                                    title="Nenhuma receita neste mês."
                                    description="As receitas lançadas aparecem aqui."
                                />
                            )
                        }
                    />
                </>
            )}
            {canWrite && (
                <RowDialogs
                    search={search}
                    onSearchChange={onSearchChange}
                    onFail={setDialogError}
                />
            )}
            {canWrite && search.novo === 1 && (
                <EarningFormDialog
                    open
                    onOpenChange={(open) => {
                        if (!open) onSearchChange({ ...search, novo: undefined });
                    }}
                />
            )}
        </div>
    );
}
