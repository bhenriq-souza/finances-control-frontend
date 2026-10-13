import { Link } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Plus, Tags } from 'lucide-react';

import { useCan } from '@/api/permissions';
import { useAccountLookup, useCardLookup, type Lookup } from '@/api/queries/lookups';
import { addMonths, formatDate, formatMonth, monthOf } from '@/shared/dates';
import { Button, buttonVariants } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { Money } from '@/ui/money';
import { EntryListSkeleton } from '@/ui/skeleton';
import { StatusBadge } from '@/ui/status-badge';
import { expenseBadge } from '@/ui/status-labels';

import { ExpenseFormDialog } from '../form/expense-form';

import { ExpenseFilters, FilterTags } from './expense-filters';
import {
    asApiError,
    expenseListQuery,
    FILTER_KEYS,
    listMonth,
    useExpenses,
    type ExpenseListSearch,
} from './expense-list-search';
import {
    expenseSupportText,
    sortExpenses,
    summarizeExpenses,
    summaryCountsText,
    type Expense,
} from './expense-model';

export interface ExpenseListPageProps {
    search: ExpenseListSearch;
    onSearchChange: (next: ExpenseListSearch) => void;
}

/** Valor da despesa: `Money` negado, com o `−` sempre visível (INV-0012-01). */
function ExpenseAmount({ cents, size }: { cents: number; size?: 'valor' | 'valor-destaque' }) {
    return <Money cents={-cents} sign="always" tone="auto" size={size} />;
}

function paymentLabel(expense: Expense, accounts: Lookup, cards: Lookup): string {
    if (expense.bankAccountId) return accounts.label(expense.bankAccountId);
    return expense.creditCardId ? cards.label(expense.creditCardId) : '';
}

function Description({ expense }: { expense: Expense }) {
    const support = expenseSupportText(expense);
    return (
        <span className="flex flex-col">
            <span>{expense.description}</span>
            {support && <span className="text-pequeno text-texto-apoio">{support}</span>}
        </span>
    );
}

function columnsFor(accounts: Lookup, cards: Lookup): readonly EntryColumn<Expense>[] {
    return [
        { header: 'Data', cell: (expense) => formatDate(expense.occurredOn, 'relativa') },
        { header: 'Descrição', cell: (expense) => <Description expense={expense} /> },
        { header: 'Tipo', cell: (expense) => expense.expenseType.name, hideBelow: 'lg' },
        { header: 'Conta / cartão', cell: (expense) => paymentLabel(expense, accounts, cards) },
        { header: 'Status', cell: (expense) => <StatusBadge badge={expenseBadge(expense)} /> },
        {
            header: 'Valor',
            cell: (expense) => <ExpenseAmount cents={expense.amountCents} />,
            align: 'end',
        },
    ];
}

/** Cartão do celular: descrição e valor; depois data, conta ou cartão e selo. */
function ExpenseCard({ expense, payment }: { expense: Expense; payment: string }) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
                <span className="text-corpo-forte">
                    <Description expense={expense} />
                </span>
                <ExpenseAmount cents={expense.amountCents} />
            </div>
            <div className="flex items-center justify-between gap-3 text-pequeno text-texto-apoio">
                <span>
                    {formatDate(expense.occurredOn, 'relativa')} · {payment}
                </span>
                <StatusBadge badge={expenseBadge(expense)} />
            </div>
        </div>
    );
}

function MonthNavigation({ search, onSearchChange }: ExpenseListPageProps) {
    const month = listMonth(search);
    const go = (n: number) => onSearchChange({ ...search, mes: addMonths(month, n) });
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

function Summary({ expenses }: { expenses: readonly Expense[] }) {
    const summary = summarizeExpenses(expenses);
    return (
        <section
            aria-label="Resumo"
            className="flex flex-col gap-1 rounded-md border border-linha bg-superficie p-4"
        >
            <span className="text-rotulo text-texto-apoio">Total</span>
            <ExpenseAmount cents={summary.totalCents} size="valor-destaque" />
            <p className="text-pequeno text-texto-apoio">{summaryCountsText(summary)}</p>
        </section>
    );
}

/**
 * Lista de despesas (`/despesas`, spec 0012): mês com navegação, filtros na URL, resumo somado no
 * cliente e o `EntryList` em ordem de data. **Nova despesa** e **Tipos de despesa** só com
 * `entries.write` (INV-0009-03).
 */
export function ExpenseListPage({ search, onSearchChange }: ExpenseListPageProps) {
    const canWrite = useCan('entries.write');
    const accounts = useAccountLookup();
    const cards = useCardLookup();
    const query = useExpenses(expenseListQuery(search));
    const hasFilters = FILTER_KEYS.some((key) => key !== 'grupo' && search[key] !== undefined);

    let content;
    if (query.isError) {
        content = (
            <EmptyState
                variant="erro"
                error={asApiError(query.error)}
                onRetry={() => void query.refetch()}
            />
        );
    } else if (!query.data) {
        content = <EntryListSkeleton />;
    } else {
        const expenses = sortExpenses(query.data);
        content = (
            <>
                <Summary expenses={expenses} />
                <EntryList
                    items={expenses}
                    getKey={(expense) => expense.id}
                    caption={
                        search.grupo ? 'Parcelas' : `Despesas de ${formatMonth(listMonth(search))}`
                    }
                    columns={columnsFor(accounts, cards)}
                    renderCard={(expense) => (
                        <ExpenseCard
                            expense={expense}
                            payment={paymentLabel(expense, accounts, cards)}
                        />
                    )}
                    href={(expense) => `/despesas/${expense.id}`}
                    empty={
                        <EmptyState
                            variant="vazio"
                            title={
                                hasFilters
                                    ? 'Nenhuma despesa com estes filtros.'
                                    : 'Nenhuma despesa neste mês.'
                            }
                            description="As despesas lançadas aparecem aqui."
                        />
                    }
                />
            </>
        );
    }

    return (
        <div className="flex flex-col gap-4 pb-16 md:gap-6 md:pb-0">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-titulo-1">Despesas</h1>
                {canWrite && (
                    <div className="flex items-center gap-3">
                        <Link
                            to="/despesas/tipos"
                            className={buttonVariants({ variant: 'outline' })}
                        >
                            <Tags aria-hidden="true" />
                            Tipos de despesa
                        </Link>
                        <Button
                            onClick={() => onSearchChange({ ...search, novo: 1 })}
                            className="fixed right-4 bottom-20 z-10 shadow-[var(--ft-sombra-flutuante)] md:static md:shadow-none"
                        >
                            <Plus aria-hidden="true" />
                            Nova despesa
                        </Button>
                    </div>
                )}
            </header>
            {search.grupo ? (
                <h2 className="text-titulo-3">Todas as parcelas</h2>
            ) : (
                <MonthNavigation search={search} onSearchChange={onSearchChange} />
            )}
            <ExpenseFilters search={search} onSearchChange={onSearchChange} />
            <FilterTags search={search} onSearchChange={onSearchChange} />
            {content}
            {canWrite && search.novo === 1 && (
                <ExpenseFormDialog
                    open
                    onOpenChange={(open) => {
                        if (!open) onSearchChange({ ...search, novo: undefined });
                    }}
                    // Depois de criar: o mês da primeira criada, sem filtros nem `novo`, sem abrir
                    // o detalhe (AC-0012-14).
                    onCreated={(first) => onSearchChange({ mes: monthOf(first.occurredOn) })}
                />
            )}
        </div>
    );
}
