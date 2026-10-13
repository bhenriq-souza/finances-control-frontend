import { Link } from '@tanstack/react-router';
import { CalendarX, ChevronLeft } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { useCan } from '@/api/permissions';
import { useAccountLookup, useCardLookup } from '@/api/queries/lookups';
import { formatDate } from '@/shared/dates';
import { Button } from '@/ui/components/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { EntryList, type EntryColumn } from '@/ui/entry-list';
import { Money } from '@/ui/money';
import { EntryListSkeleton, Skeleton } from '@/ui/skeleton';
import { StatusBadge } from '@/ui/status-badge';
import { expenseBadge } from '@/ui/status-labels';

import { asApiError, useExpenses } from '../list/expense-list-search';
import type { Expense } from '../list/expense-model';

import { type ExpenseRecurrence, useExpenseRecurrence } from './api';
import { EndExpenseRecurrenceDialog } from './end-recurrence';
import { paymentOf, useExpenseTypeNames } from './expense-recurrences';
import { dayOfMonthText, isEnded, occurrencesOf, occurrenceWindow } from './recurrence-model';
import type { ExpenseRecurrenceSearch } from './search';

const LIST = '/series';

const LINK_CLASS =
    'rounded-sm text-acento underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-foco';

export interface ExpenseRecurrenceDetailPageProps {
    recurrenceId: string;
    search: ExpenseRecurrenceSearch;
    /** Atualiza os parâmetros de busca da rota (os não citados ficam como estão). */
    onSearchChange: (next: Partial<ExpenseRecurrenceSearch>) => void;
}

/** `/series/despesas/$serieId` (spec 0017, "Detalhe"). */
export function ExpenseRecurrenceDetailPage({
    recurrenceId,
    search,
    onSearchChange,
}: ExpenseRecurrenceDetailPageProps) {
    const query = useExpenseRecurrence(recurrenceId);

    let content: ReactNode;
    // Com dado, ele vale mesmo que um recarregamento falhe.
    if (query.data) {
        content = (
            <RecurrenceDetail
                recurrence={query.data}
                search={search}
                onSearchChange={onSearchChange}
            />
        );
    } else if (query.isError) {
        const error = asApiError(query.error);
        content =
            error.code === 'EXPENSE_RECURRENCE_NOT_FOUND' ? (
                <EmptyState variant="nao-encontrado" backTo={LIST} />
            ) : (
                <EmptyState variant="erro" error={error} onRetry={() => void query.refetch()} />
            );
    } else {
        content = (
            <div role="status" aria-label="Carregando" className="flex flex-col gap-3">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    return (
        <div className="flex max-w-3xl flex-col gap-4">
            <Link to={LIST} className={`inline-flex items-center gap-1 self-start ${LINK_CLASS}`}>
                <ChevronLeft aria-hidden="true" className="size-4" />
                Séries fixas
            </Link>
            {content}
        </div>
    );
}

function Item({ term, children }: { term: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1 border-t border-linha py-3 first:border-t-0 md:flex-row md:gap-4">
            <dt className="text-rotulo text-texto-apoio md:w-44 md:shrink-0">{term}</dt>
            <dd className="text-corpo text-texto">{children}</dd>
        </div>
    );
}

/**
 * Um diálogo aberto pela URL só abre se a ação existe; aberto, fica aberto mesmo que um
 * recarregamento a tire (o erro continua à vista).
 */
function useLatchedOpen(requested: boolean, allowed: boolean): boolean {
    const [latched, setLatched] = useState(false);
    const open = requested && (allowed || latched);
    if (open !== latched) setLatched(open);
    return open;
}

function RecurrenceDetail({
    recurrence,
    search,
    onSearchChange,
}: Omit<ExpenseRecurrenceDetailPageProps, 'recurrenceId'> & { recurrence: ExpenseRecurrence }) {
    const canWrite = useCan('entries.write');
    const typeName = useExpenseTypeNames();
    const accounts = useAccountLookup();
    const cards = useCardLookup();
    const canEnd = canWrite && !isEnded(recurrence);
    const endOpen = useLatchedOpen(canWrite && search.encerrar === 1, canEnd);

    return (
        <article className="flex flex-col gap-4">
            <header className="flex flex-col gap-2">
                <h1 className="text-titulo-1">{recurrence.description}</h1>
                <Money
                    cents={-recurrence.amountCents}
                    sign="always"
                    tone="auto"
                    size="valor-destaque"
                />
                {canEnd && (
                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" onClick={() => onSearchChange({ encerrar: 1 })}>
                            <CalendarX aria-hidden="true" />
                            Encerrar série
                        </Button>
                    </div>
                )}
            </header>

            <section className="rounded-md border border-linha bg-superficie px-4 md:px-6">
                <dl className="flex flex-col">
                    <Item term="Tipo">{typeName(recurrence.typeId)}</Item>
                    <Item term="Repetição">{dayOfMonthText(recurrence.dayOfMonth)}</Item>
                    <Item term={recurrence.creditCardId ? 'Cartão' : 'Conta'}>
                        {paymentOf(recurrence, accounts, cards)}
                    </Item>
                    <Item term="Início">{formatDate(recurrence.startsOn, 'longa')}</Item>
                    <Item term="Próxima ocorrência">
                        {recurrence.nextOccurrenceOn
                            ? formatDate(recurrence.nextOccurrenceOn, 'longa')
                            : '—'}
                    </Item>
                    <Item term="Fim">
                        {recurrence.endsOn ? formatDate(recurrence.endsOn, 'longa') : 'Sem fim'}
                    </Item>
                </dl>
            </section>

            <Occurrences recurrence={recurrence} />

            {endOpen && (
                <EndExpenseRecurrenceDialog
                    open
                    recurrence={recurrence}
                    onOpenChange={(open) => {
                        if (!open) onSearchChange({ encerrar: undefined });
                    }}
                />
            )}
        </article>
    );
}

const occurrenceColumns: readonly EntryColumn<Expense>[] = [
    { header: 'Data', cell: (expense) => formatDate(expense.occurredOn, 'longa') },
    { header: 'Descrição', cell: (expense) => expense.description },
    { header: 'Status', cell: (expense) => <StatusBadge badge={expenseBadge(expense)} /> },
    {
        header: 'Valor',
        cell: (expense) => <Money cents={-expense.amountCents} sign="always" tone="auto" />,
        align: 'end',
    },
];

/**
 * As ocorrências: `GET /expenses` no período da série, filtradas no cliente pelo `recurrenceId`
 * (a API não filtra por série; INV-0017-03), em ordem de data.
 */
function Occurrences({ recurrence }: { recurrence: ExpenseRecurrence }) {
    const query = useExpenses(occurrenceWindow(recurrence));

    let content: ReactNode;
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
        content = (
            <EntryList
                items={occurrencesOf(query.data, recurrence.id)}
                getKey={(expense) => expense.id}
                caption="Ocorrências da série"
                columns={occurrenceColumns}
                href={(expense) => `/despesas/${expense.id}`}
                renderCard={(expense) => (
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                            <span className="text-corpo-forte">
                                {formatDate(expense.occurredOn, 'longa')}
                            </span>
                            <StatusBadge badge={expenseBadge(expense)} />
                        </div>
                        <Money cents={-expense.amountCents} sign="always" tone="auto" />
                    </div>
                )}
                empty={
                    <EmptyState
                        variant="vazio"
                        title="Nenhuma ocorrência no período."
                        description="As ocorrências da série aparecem aqui."
                    />
                }
            />
        );
    }

    return (
        <section className="flex flex-col gap-3">
            <h2 className="text-titulo-3">Ocorrências</h2>
            {content}
        </section>
    );
}
